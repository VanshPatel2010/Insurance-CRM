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
  "premium": null,
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
    "dateOfBirth": null,
    "age": null,
    "gender": "",
    "bloodGroup": "",
    "preExistingConditions": "",
    "smoker": null,
    "membersCount": null,
    "memberNames": [],
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
    "travelers": [{"name": "", "age": "", "relationship": ""}],
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
`.trim();

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
      .slice(0, 8000)
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
      model: 'llama-3.3-70b-versatile',
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
  const model = 'gemini-3.1-flash-lite-preview'; // Ensure you're using the standard REST model name

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
        responseMimeType: 'application/json' // Forces Gemini to return pure JSON
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

/**
 * Hybrid Text-First extraction strategy
 */
export async function extractPolicyData(pdfBuffer: Buffer): Promise<ExtractionResult> {
  try {
    console.log('[aiExtraction] Extracting text from PDF…');
    const extractedText = await extractTextFromPdf(pdfBuffer);

    const isDigitalPdf = extractedText.length > 50;
    console.log(
      `[aiExtraction] PDF classified as ${isDigitalPdf ? 'digital' : 'scanned'} (text length: ${extractedText.length})`
    );

    if (isDigitalPdf) {
      console.log('[aiExtraction] Sending text to Gemini API…');
      try {
        const data = await geminiExtractText(extractedText);
        return {
          success: true,
          data,
          provider: 'gemini-text',
        };
      } catch (geminiErr) {
        console.warn(`[aiExtraction] Gemini text extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
        const data = await groqExtractText(extractedText);
        return {
          success: true,
          data,
          provider: 'groq-text',
        };
      }
    } else {
      console.log('[aiExtraction] Extracting image from scanned PDF…');
      const base64Image = await extractFirstImageAsBase64(pdfBuffer);

      if (base64Image) {
        console.log('[aiExtraction] Sending image to Gemini API…');
        try {
          const data = await geminiExtractImage(base64Image);
          return {
            success: true,
            data,
            provider: 'gemini-vision',
          };
        } catch (geminiErr) {
          console.warn(`[aiExtraction] Gemini image extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
          const data = await groqExtractImage(base64Image);
          return {
            success: true,
            data,
            provider: 'groq-vision',
          };
        }
      } else {
        console.log('[aiExtraction] No image found; falling back to text extraction…');
        try {
          const data = await geminiExtractText(extractedText);
          return {
            success: true,
            data,
            provider: 'gemini-text-fallback',
          };
        } catch (geminiErr) {
          console.warn(`[aiExtraction] Gemini fallback text extraction failed: ${(geminiErr as Error).message}. Trying Groq...`);
          const data = await groqExtractText(extractedText);
          return {
            success: true,
            data,
            provider: 'groq-text-fallback',
          };
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