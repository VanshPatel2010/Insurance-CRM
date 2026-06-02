/**
 * aiExtraction.ts — Hybrid Text-First Extraction Strategy
 *
 * VERCEL SERVERLESS SAFE: No canvas, @napi-rs/canvas, or puppeteer.
 * Uses ONLY pdf-parse, pdfjs-dist, and Gemini API (Groq commented out).
 *
 * ─── STRATEGY ──────────────────────────────────────────────────────────────
 * Step 1: Text Extraction  → extract text from PDF using pdf-parse
 * Step 2: Scanned Check    → if text.length > 50: digital PDF, else: scanned
 * Step 3a: Digital PDF     → send text to Gemini with JSON response mime type
 * Step 3b: Scanned PDF     → extract image from PDF, send to Gemini
 * Step 4: Post-Processing  → sanitize + validate extracted data (NEW)
 */
import { resolve } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractionSuccess = {
  success: true;
  data: unknown;
  provider: string;
};

export type ExtractionFailure = {
  success: false;
  fallbackToManual: true;
  message: string;
};

export type ExtractionResult = ExtractionSuccess | ExtractionFailure;

// ─── Shared extraction prompt ─────────────────────────────────────────────────

const EXTRACTION_PROMPT = `
You are an expert insurance policy data extractor for Indian insurance policies.

Extract all details from this insurance policy image and return ONLY a valid
JSON object. No explanation, no markdown code blocks, no extra text.
Return raw JSON only.

First identify the policy type:
- motor    → vehicle/car/bike/two-wheeler/auto insurance
- medical  → health/mediclaim/family floater insurance
- fire     → property/fire/building/shop insurance
- life     → life/term/endowment/ULIP/money back insurance
- personal-accident → personal accident / accidental death / disability cover
- marine   → marine cargo / inland transit / shipment / transit insurance
- workman-compensation → employee compensation / WC / employer liability / workers compensation
- travel   → travel/trip/tourism/holiday/vacation/overseas/international/flight insurance

Return this exact JSON structure (use null for fields not found):
{
  "type": "motor",
  "confidence": 95,
  "customerName": "",
  "phone": "",
  "email": "",
  "address": "",
  "policyNumber": "",
  "premium": null,              // FINAL AMOUNT WITH GST/TAX (e.g., "Final Premium" from policy)
  "premiumWithoutGst": null,    // BASE AMOUNT BEFORE GST/TAX (e.g., "Total Premium" before tax rows)
  "sumInsured": null,
  "startDate": null,
  "endDate": null,
  "insurerName": "",
  "details": {
    "vehicleReg": "",
    "make": "",
    "model": "",
    "year": null,
    "fuelType": "",
    "engineCC": null,
    "idvValue": null,
    "ncb": null,
    "addOns": [],
    "premiumWithoutGst": null,  // Same as root premiumWithoutGst
    "thirdPartyPremium": null,  // Motor package: TP liability component before GST
    "ownDamagePremium": null,   // Motor package: OD premium after discount, before GST
    "dateOfBirth": null,
    "age": null,
    "gender": "",
    "bloodGroup": "",
    "preExistingConditions": "",
    "smoker": null,
    "membersCount": null,
    "memberNames": [],
    "memberAges": [],
    "memberDateOfBirths": [],
    "members": [{"name": "", "age": "", "dateOfBirth": "", "relationship": "", "gender": ""}],
    "cashlessNetwork": "",
    "propertyType": "",
    "propertyAddress": "",
    "builtUpArea": null,
    "constructionType": "",
    "propertyValue": null,
    "stockValue": null,
    "riskLocation": "",
    "occupation": "",
    "annualIncome": null,
    "nomineeName": "",
    "nomineeRelation": "",
    "policyType": "",
    "premiumFrequency": "",
    "policyTerm": null,
    "maturityDate": null,
    "coverageType": "",
    "disabilityCover": "",
    "riskClass": "",
    "marineInsuranceType": "",
    "cargoType": "",
    "voyageFrom": "",
    "voyageTo": "",
    "transitMode": "",
    "vesselName": "",
    "employeeCount": null,
    "industryType": "",
    "totalWages": null,
    "riskCategory": "",
    "coverageLocation": "",
    "employerLiabilityLimit": null,
    "tripType": "",
    "destination": [],
    "tripStartDate": null,
    "tripEndDate": null,
    "numberOfTravelers": null,
    "travelers": [{"name": "", "age": "", "dateOfBirth": "", "relationship": ""}],
    "visaType": "",
    "activitiesCovered": [],
    "coverageAmount": null,
    "coverageType": ""
  }
}

Rules:
- Return numbers only for monetary values (no rupee symbol or commas)
- All dates in YYYY-MM-DD format
- confidence: 90-100 if policy type is clearly stated, 60-89 if reasonably identified, below 60 if uncertain
- Return null for any field not found — never guess or fabricate
- For Indian policies: amounts are in INR, interpret accordingly
- Include ONLY the fields relevant to the identified policy type in details, set others to null
- For medical/health policies, extract every covered person. Put per-person values in details.members with name, age, dateOfBirth, relationship, and gender. Also fill memberNames, memberAges, memberDateOfBirths, and membersCount when present.

PREMIUM EXTRACTION RULES (Critical for avoiding confusion):
- "premium" field = FINAL AMOUNT WITH ALL TAXES/GST = Look for: "Final Premium", "Total Premium (after tax)", "Grand Total", "Total Amount Payable", "Gross Premium"
- "premiumWithoutGst" field = BASE AMOUNT BEFORE TAX = Look for: "Total Premium", "Net Premium", "Base Premium", "Taxable Premium", "OD Premium", "TP Premium", "Total Liability Premium"
- For motor PACKAGE policies, extract the premium components separately:
  - details.thirdPartyPremium = Third Party Liability / TP premium before GST
  - details.ownDamagePremium = Own Damage / OD premium AFTER discount and BEFORE GST
  - premium = final policy premium WITH GST
- If both OD before discount and OD after discount are shown, always use the OD after discount / net OD value for details.ownDamagePremium.
- For Indian motor policies, the common layout is: [Base Premium] + [GST 9% SGST] + [GST 9% CGST] = [Final Premium]
  Example: Total Premium: 3526 + SGST (9%): 317 + CGST (9%): 317 = Final Premium: 4160
  In this case: premium=4160, premiumWithoutGst=3526
- VALIDATION: If you find both values, verify: premiumWithoutGst × 1.18 ≈ premium (for 18% GST). If not matching, reconsider.
- Never return "Total Premium" row as the final premium if there's a "Final Premium", "Gross Premium", or "Grand Total" row visible
- Priority order for FINAL amount: "Final Premium" > "Gross Premium" > "Grand Total" > "Total Amount" > "Total Premium (with tax)"
- Priority order for BASE amount: "Net Premium" > "Base Premium" > "Total Liability Premium" > "Total Premium" (only if taxes are listed separately below it)

MOTOR IDV EXTRACTION RULES (Critical for Liability-Only / Third-Party policies):
- IDV (Insured Declared Value) is found in a column explicitly labelled "Vehicle IDV" or "IDV (Rs)" or "Total IDV"
- In Liability-Only / TP-Only / Third Party policies, IDV is typically 0 or "NA" — this is CORRECT and expected
- NEVER use Chassis Number, Engine Number, Registration Number, or any vehicle identifier as IDV
- If the "Vehicle IDV" column value is 0 or blank, set idvValue to null — do NOT substitute another nearby numeric value
- The chassis number and engine number are always 5-7 digit or alphanumeric codes (e.g. 327222, 330588) — these are NOT monetary values

MOTOR POLICY SUB-TYPE DETECTION:
- If you see "Liability Only", "Third Party", "TP Only", or "Liability Only Policy" in the policy title or coverage section → set details.policyType = "TP"
- If you see "Package Policy", "Comprehensive", "Full", or "Own Damage" in the title → set details.policyType = "PACKAGE"
- For TP policies: idvValue should be null (TP policies have no IDV)
- For TP policies: sumInsured should be null (TP has no fixed sum insured)
`.trim();

// ─── Post-Processing: Sanitize and validate extracted data (NEW) ──────────────

/**
 * Detects if the extracted data is from a Liability-Only / TP-Only motor policy
 * by looking at the raw text or the policy type field.
 */
function isThirdPartyOnlyPolicy(data: Record<string, unknown>, rawText?: string): boolean {
  const policyType = String((data?.details as any)?.policyType ?? '').toLowerCase();
  if (
    policyType === 'tp' ||
    policyType.includes('third party') ||
    policyType.includes('liability only') ||
    policyType.includes('tp only')
  ) {
    return true;
  }

  // Scan raw extracted text for TP-policy indicators
  if (rawText) {
    const tpPatterns = [
      /liability\s+only\s+policy/i,
      /third\s+party\s+(liability|only)/i,
      /tp\s+only/i,
      /IRDAN\d+RP0040V/i, // Bajaj TP policy UIN pattern
    ];
    if (tpPatterns.some(p => p.test(rawText))) return true;
  }

  return false;
}

/**
 * Known vehicle identifier ranges to reject as IDV.
 * Chassis numbers, engine numbers etc. are typically 4-7 digits,
 * while a realistic IDV for a car is ₹50,000 – ₹50,00,000.
 */
function isUnrealisticIdv(value: number | null | undefined): boolean {
  if (value == null) return false;
  // IDV below ₹10,000 or above ₹5 crore is almost certainly wrong for a private car
  return value < 10_000 || value > 50_000_000;
}

/**
 * Validates and cross-checks premium vs premiumWithoutGst.
 * Returns corrected [premium, premiumWithoutGst].
 *
 * Indian GST on motor insurance is 18% (9% SGST + 9% CGST).
 * Some policies show 0% for specific items, but the blended rate on TP is 18%.
 */
function reconcilePremiums(
  premium: number | null,
  premiumWithoutGst: number | null,
): [number | null, number | null] {
  if (premium == null && premiumWithoutGst == null) return [null, null];

  // If only one is present, derive the other
  if (premium != null && premiumWithoutGst == null) {
    // Assume 18% GST → base = final / 1.18
    const derived = Math.round(premium / 1.18);
    return [premium, derived];
  }
  if (premiumWithoutGst != null && premium == null) {
    // Derive final from base
    const derived = Math.round(premiumWithoutGst * 1.18);
    return [derived, premiumWithoutGst];
  }

  // Both present — validate they make sense
  if (premium != null && premiumWithoutGst != null) {
    // premium must always be > premiumWithoutGst (since GST > 0)
    if (premium < premiumWithoutGst) {
      // They are swapped — fix it
      console.warn('[postProcess] premium < premiumWithoutGst — values appear swapped, correcting.');
      return [premiumWithoutGst, premium];
    }

    const ratio = premium / premiumWithoutGst;
    // Acceptable GST range: 0% to 28% → ratio between 1.0 and 1.28
    if (ratio < 1.0 || ratio > 1.30) {
      console.warn(`[postProcess] Premium ratio ${ratio.toFixed(3)} outside expected GST range. Flagging.`);
      // Don't auto-correct here; return as-is and let the caller decide
    }
  }

  return [premium, premiumWithoutGst];
}

/**
 * Main post-processing function. Takes raw AI output and applies
 * deterministic validation / correction rules.
 *
 * @param rawData  - JSON object returned by the AI
 * @param rawText  - Original extracted PDF text (used for pattern matching)
 */
function postProcessExtraction(rawData: unknown, rawText?: string): unknown {
  if (!rawData || typeof rawData !== 'object') return rawData;

  // Deep clone to avoid mutation
  const data = JSON.parse(JSON.stringify(rawData)) as Record<string, unknown>;
  const details = (data.details ?? {}) as Record<string, unknown>;
  const policyType = String(details.policyType ?? '').trim().toLowerCase();

  if (
    policyType.includes('package') ||
    policyType.includes('comprehensive') ||
    policyType.includes('full')
  ) {
    details.policyType = 'PACKAGE';
  }
  if (details.ownDamagePremium == null) {
    details.ownDamagePremium =
      details.netOdPremium ?? details.netODPremium ?? details.odPremiumAfterDiscount ?? null;
  }

  // ── 1. IDV SANITIZATION ────────────────────────────────────────────────────
  // Rule: TP-only policies should never have an IDV
  if (isThirdPartyOnlyPolicy(data, rawText)) {
    if (details.idvValue != null) {
      console.warn(
        `[postProcess] TP-only policy — clearing AI-assigned idvValue: ${details.idvValue}`
      );
      details.idvValue = null;
    }
    // Also ensure policyType is set correctly
    details.policyType = 'TP';
    // TP policies have no sum insured
    if (data.sumInsured != null) {
      data.sumInsured = null;
    }
  } else {
    // Comprehensive policies: reject chassis/engine numbers masquerading as IDV
    const idv = details.idvValue as number | null;
    if (idv != null && isUnrealisticIdv(idv)) {
      console.warn(
        `[postProcess] Unrealistic IDV value detected (${idv}) — likely a chassis/engine number. Clearing.`
      );
      details.idvValue = null;
    }
  }

  // ── 2. PREMIUM / GST RECONCILIATION ────────────────────────────────────────
  const rawPremium = toNumberOrNull(data.premium);
  const rawBase = toNumberOrNull(data.premiumWithoutGst);

  const [correctedPremium, correctedBase] = reconcilePremiums(rawPremium, rawBase);

  data.premium = correctedPremium;
  data.premiumWithoutGst = correctedBase;

  // Mirror into details as well (your schema duplicates it)
  details.premiumWithoutGst = correctedBase;

  // ── 3. DATE FORMAT NORMALIZATION ───────────────────────────────────────────
  // Ensure dates are YYYY-MM-DD. The AI sometimes returns DD-MM-YYYY or DD/MM/YYYY.
  for (const field of ['startDate', 'endDate'] as const) {
    const raw = data[field];
    if (typeof raw === 'string' && raw) {
      data[field] = normalizeDateString(raw);
    }
  }

  data.details = details;
  return data;
}

/**
 * Converts a value to a number, stripping currency symbols/commas.
 * Returns null if not parseable or already null.
 */
function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[₹,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Normalizes various Indian date formats to YYYY-MM-DD.
 * Handles: DD-MM-YYYY, DD/MM/YYYY, D-M-YYYY, YYYY-MM-DD (passthrough)
 */
function normalizeDateString(raw: string): string {
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Return as-is if we can't parse it
  return raw;
}

// ─── PDF → Image extraction (Vercel-safe, no canvas rendering) ──────────────

async function extractFirstImageAsBase64(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const pdfjs = await loadPdfJs();

    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({
      data,
      disableFontFace: true,
      nativeImageDecoderSupport: 'none',
      standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/',
      cMapUrl: './node_modules/pdfjs-dist/cmaps/',
    });
    const pdfDoc = await loadingTask.promise;

    const page = await pdfDoc.getPage(1);
    const resources = page.getResources?.() || {};
    const XObject = resources.XObject?.getAll?.();

    if (XObject) {
      for (const [name, xobj] of Object.entries(XObject)) {
        try {
          const xobjData = await xobj as any;
          if (xobjData.subtype === 'Image' && xobjData.data) {
            const imgBuffer = Buffer.isBuffer(xobjData.data)
              ? xobjData.data
              : Buffer.from(xobjData.data);

            const base64 = imgBuffer.toString('base64');
            console.log('[aiExtraction] Extracted image from PDF resources');
            await pdfDoc.destroy();
            return base64;
          }
        } catch (err) {
          console.warn(
            `[aiExtraction] Error processing XObject ${name}:`,
            (err as Error).message
          );
        }
      }
    }

    await pdfDoc.destroy();
    console.log('[aiExtraction] No embedded images found in PDF');
    return null;
  } catch (err) {
    console.warn(
      '[aiExtraction] Image extraction error:',
      (err as Error).message
    );
    return null;
  }
}

// ─── JSON parsing helper ──────────────────────────────────────────────────────

function parseJsonResponse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned);
}

export function hasUsefulExtractionData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const record = data as Record<string, unknown>;
  const topLevelFields = ['customerName', 'policyNumber', 'premium', 'sumInsured', 'startDate', 'endDate', 'address', 'email', 'phone'];
  if (topLevelFields.some(field => {
    const value = record[field];
    return value != null && value !== '' && !(Array.isArray(value) && value.length === 0);
  })) {
    return true;
  }

  const details = record.details;
  if (details && typeof details === 'object') {
    return Object.values(details as Record<string, unknown>).some(value =>
      value != null && value !== '' && !(Array.isArray(value) && value.length === 0)
    );
  }

  return false;
}

async function ensureServerDomMatrix(): Promise<void> {
  if (typeof globalThis.DOMMatrix === 'function') return;
  try {
    const dommatrix = await import('dommatrix');
    const DOMMatrixImpl = (dommatrix as any).DOMMatrix ?? (dommatrix as any).default ?? dommatrix;
    if (typeof DOMMatrixImpl === 'function') {
      globalThis.DOMMatrix = DOMMatrixImpl;
    }
  } catch (err) {
    console.warn('[aiExtraction] Failed to polyfill DOMMatrix:', (err as Error).message);
  }
}

async function loadPdfJs() {
  await ensureServerDomMatrix();
  const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = pdfModule as any;
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${resolve(
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  )}`;
  return pdfjs as any;
}

// ─── Step 1: Extract text from PDF using pdfjs-dist (Vercel-Safe) ───────────

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfjs = await loadPdfJs();

    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({
      data,
      disableFontFace: true,
      nativeImageDecoderSupport: 'none',
      standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/',
      cMapUrl: './node_modules/pdfjs-dist/cmaps/',
    });
    const pdfDoc = await loadingTask.promise;

    const numPages = Math.min(pdfDoc.numPages, 5);
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `[Page ${i}] ${pageText}\n`;
    }

    await pdfDoc.destroy();

    return fullText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
      .replace(/[-*_]{3,}/g, ' ')
      .replace(/This is a computer generated document and does not require signature.*/gi, '')
      .replace(/For any grievance, please contact the insurance ombudsman.*/gi, '')
      .replace(/\s+/g, ' ')
      .slice(0, 9000)
      .trim();

  } catch (err) {
    console.error('[aiExtraction] pdfjs text extraction failed:', err);
    return '';
  }
}

// ─── Groq API Implementations ──────────────────────────────────────────────────

async function groqExtractText(text: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `DOCUMENT DATA FOR PROCESSING:
---
${cleanText}
---

STRICT INSTRUCTIONS:
1. You are a data extraction engine.
2. Return ONLY a valid JSON object starting with {"type": ...
3. DO NOT repeat any text from the document above.
4. DO NOT include any preamble, headers, or markdown formatting.
5. If you echo the document text, the system will fail. Output ONLY the JSON.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (res.status === 429) throw new Error('Groq rate limited (429)');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${JSON.stringify(errData)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  return parseJsonResponse(raw);
}

async function groqExtractImage(base64Image: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (res.status === 429) throw new Error('Groq rate limited (429)');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${JSON.stringify(errData)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Groq returned empty response');
  return parseJsonResponse(raw);
}

// ─── Gemini API Implementations ───────────────────────────────────────────────

/**
 * Step 3a: Send extracted text to Gemini for digital PDFs.
 */
async function geminiExtractText(text: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  const model = 'gemini-3.1-flash-lite';

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_PROMPT },
            { text: `DOCUMENT DATA FOR PROCESSING:\n---\n${cleanText}\n---` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json'
      }
    })
  });

  if (res.status === 429) throw new Error('Gemini rate limited (429)');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(errData)}`);
  }
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Gemini returned empty response');

  return parseJsonResponse(raw);
}

/**
 * Step 3b: Send extracted image to Gemini for scanned PDFs.
 */
async function geminiExtractImage(base64Image: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = 'gemini-1.5-flash';

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json'
      }
    })
  });

  if (res.status === 429) throw new Error('Gemini rate limited (429)');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(errData)}`);
  }

  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Gemini returned empty response');

  return parseJsonResponse(raw);
}

// ─── Main Controller ──────────────────────────────────────────────────────────

export type PreExtractedData = {
  text?: string;
  image?: string;
};

/**
 * Hybrid Text-First extraction strategy
 * Now supports pre-extracted text or images from the client to offload processing.
 */
export async function extractPolicyData(input: Buffer | PreExtractedData): Promise<ExtractionResult> {
  try {
    let extractedText: string | undefined;
    let base64Image: string | undefined | null;
    let isDigitalPdf = false;

    if (Buffer.isBuffer(input)) {
      console.log('[aiExtraction] Input is Buffer; extracting text from PDF…');
      extractedText = await extractTextFromPdf(input);
      isDigitalPdf = (extractedText?.length ?? 0) > 50;
      console.log(
        `[aiExtraction] PDF classified as ${isDigitalPdf ? 'digital' : 'scanned'} (text length: ${extractedText?.length})`
      );
    } else {
      console.log('[aiExtraction] Input is pre-extracted data from client');
      extractedText = input.text;
      base64Image = input.image;
      isDigitalPdf = !!extractedText && extractedText.length > 50;
    }

    if (isDigitalPdf && extractedText) {
      console.log('[aiExtraction] Sending text to Gemini API…');
      try {
        const rawData = await geminiExtractText(extractedText);
        // ── NEW: Post-process to fix known AI mistakes ──
        const data = postProcessExtraction(rawData, extractedText);
        return { success: true, data, provider: 'gemini-text' };
      } catch (geminiErr) {
        console.warn(`[aiExtraction] Gemini text extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
        const rawData = await groqExtractText(extractedText);
        const data = postProcessExtraction(rawData, extractedText);
        return { success: true, data, provider: 'groq-text' };
      }
    } else {
      if (Buffer.isBuffer(input)) {
        console.log('[aiExtraction] Extracting image from scanned PDF…');
        base64Image = await extractFirstImageAsBase64(input);
      }

      if (base64Image) {
        console.log('[aiExtraction] Sending image to Gemini API…');
        try {
          const rawData = await geminiExtractImage(base64Image);
          // ── NEW: Post-process (no raw text available for image path) ──
          const data = postProcessExtraction(rawData, extractedText);
          return { success: true, data, provider: 'gemini-vision' };
        } catch (geminiErr) {
          console.warn(`[aiExtraction] Gemini image extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
          const rawData = await groqExtractImage(base64Image);
          const data = postProcessExtraction(rawData, extractedText);
          return { success: true, data, provider: 'groq-vision' };
        }
      } else {
        console.log('[aiExtraction] No image found; falling back to text extraction…');
        const textToUse = extractedText || '';
        try {
          const rawData = await geminiExtractText(textToUse);
          const data = postProcessExtraction(rawData, textToUse);
          return { success: true, data, provider: 'gemini-text-fallback' };
        } catch (geminiErr) {
          console.warn(`[aiExtraction] Gemini fallback text extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
          const rawData = await groqExtractText(textToUse);
          const data = postProcessExtraction(rawData, textToUse);
          return { success: true, data, provider: 'groq-text-fallback' };
        }
      }
    }
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error('[aiExtraction] Extraction failed completely:', errorMsg);

    if (errorMsg.includes('429') || errorMsg.includes('rate limited')) {
      return {
        success: false,
        fallbackToManual: true,
        message:
          'AI API rate limit reached. Please try again in a few moments or fill in details manually.',
      };
    }

    if (errorMsg.includes('not configured')) {
      return {
        success: false,
        fallbackToManual: true,
        message:
          'AI extraction service not properly configured. Please fill in details manually.',
      };
    }

    return {
      success: false,
      fallbackToManual: true,
      message:
        'AI extraction service encountered an error. Please fill in details manually.',
    };
  }
}
