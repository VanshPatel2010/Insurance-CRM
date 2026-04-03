/**
 * aiExtraction.ts
 *
 * Multi-provider PDF policy extractor with automatic fallback.
 *
 * Fallback order:
 *   1. Gemini 2.5 Flash Lite  — native PDF support, primary provider
 *   2. Groq (Llama 4 Scout)   — vision via PDF→JPEG conversion
 *   3. HuggingFace (Llama 3.2 Vision) — vision via PDF→JPEG conversion
 *   4. Together AI (Llama 3.2 Vision Turbo) — vision via PDF→JPEG conversion
 *
 * Each provider is skipped when:
 *   a) its API key is not configured, OR
 *   b) its daily usage budget is exhausted (tracked in MongoDB via providerUsage.ts)
 *
 * If all providers fail, returns { success: false, fallbackToManual: true }.
 */

import { isProviderAvailable, incrementUsage } from '@/lib/providerUsage';

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
    "maturityDate": null
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

// ─── PDF → JPEG base64 conversion (pdfjs-dist + @napi-rs/canvas) ─────────────

/**
 * Renders the first page of a PDF to a JPEG base64 string.
 * Uses pdfjs-dist (pure JS) + @napi-rs/canvas (pre-built binaries, Vercel-safe).
 * Canvas scale 2.0 gives ~1400×1800 px for a typical A4 — enough for accurate OCR.
 */
async function pdfToJpegBase64(pdfBuffer: Buffer): Promise<string> {
  // pdfjs-dist v5 exports only "build/pdf.mjs" — no legacy directory
  const pdfjs = await import('pdfjs-dist');
  const { createCanvas } = await import('@napi-rs/canvas');

  // Disable the web worker — we're in Node.js serverless, no worker thread needed
  pdfjs.GlobalWorkerOptions.workerSrc = '';

  // Setting workerSrc='' above already disables the worker in Node.js.
  // 'disableWorker' was removed from DocumentInitParameters in pdfjs-dist v5.
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  // @napi-rs/canvas context is sufficiently compatible with the DOM API
  // that pdfjs can render into it without issues.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  // pdfjs-dist v5 RenderParameters requires both 'canvas' and 'canvasContext'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context, viewport }).promise;
  await pdfDoc.destroy();

  // encode() returns a Buffer directly — much faster than toDataURL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jpegBuffer = await (canvas as any).encode('jpeg', 85) as Buffer;
  return jpegBuffer.toString('base64');
}

// ─── JSON parsing helper ──────────────────────────────────────────────────────

function parseJsonResponse(raw: string): unknown {
  // First try direct parse
  try { return JSON.parse(raw); } catch { /* fall through */ }
  // Strip markdown fences and try again
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned); // throws if still invalid
}

// ─── Provider implementations ─────────────────────────────────────────────────

/** 1. Gemini 2.5 Flash Lite — sends the raw PDF as inline_data (no image conversion). */
async function tryGemini(pdfBuffer: Buffer): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const base64 = pdfBuffer.toString('base64');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Gemini returned empty response');
  return parseJsonResponse(raw);
}

/** 2. Groq — Llama 4 Scout vision model (PDF→JPEG). */
async function tryGroq(jpegBase64: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Groq returned empty response');
  return parseJsonResponse(raw);
}

/** 3. HuggingFace Inference API — Llama 3.2 Vision (PDF→JPEG). */
async function tryHuggingFace(jpegBase64: string): Promise<unknown> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not configured');

  const res = await fetch(
    'https://api-inference.huggingface.co/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.2-11B-Vision-Instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HuggingFace ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('HuggingFace returned empty response');
  return parseJsonResponse(raw);
}

/** 4. Together AI — Llama 3.2 Vision Turbo (PDF→JPEG). */
async function tryTogether(jpegBase64: string): Promise<unknown> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('TOGETHER_API_KEY not configured');

  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Together AI ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Together AI returned empty response');
  return parseJsonResponse(raw);
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Extracts insurance policy data from a PDF buffer.
 *
 * Tries each provider in order. A provider is skipped when:
 *   - its API key is missing from environment variables, OR
 *   - its daily usage budget is exhausted (per providerUsage.ts)
 *
 * Image conversion (PDF→JPEG) is performed lazily — only when Gemini is
 * unavailable, to avoid the overhead on the happy path.
 */
export async function extractPolicyData(pdfBuffer: Buffer): Promise<ExtractionResult> {
  let jpegBase64: string | null = null;

  /** Converts PDF to JPEG lazily (only once, cached in jpegBase64). */
  async function getImage(): Promise<string> {
    if (!jpegBase64) {
      jpegBase64 = await pdfToJpegBase64(pdfBuffer);
    }
    return jpegBase64;
  }

  // ── Provider pipeline ────────────────────────────────────────────────────────

  // 1. Gemini (native PDF — no image conversion needed)
  if (await isProviderAvailable('gemini')) {
    try {
      console.log('[aiExtraction] Trying Gemini…');
      const data = await tryGemini(pdfBuffer);
      await incrementUsage('gemini');
      console.log('[aiExtraction] ✓ Gemini succeeded');
      return { success: true, data, provider: 'gemini' };
    } catch (err) {
      console.warn('[aiExtraction] Gemini failed:', (err as Error).message);
    }
  } else {
    console.log('[aiExtraction] Gemini daily limit reached — skipping');
  }

  // 2. Groq
  if (await isProviderAvailable('groq')) {
    try {
      console.log('[aiExtraction] Trying Groq…');
      const img = await getImage();
      const data = await tryGroq(img);
      await incrementUsage('groq');
      console.log('[aiExtraction] ✓ Groq succeeded');
      return { success: true, data, provider: 'groq' };
    } catch (err) {
      console.warn('[aiExtraction] Groq failed:', (err as Error).message);
    }
  } else {
    console.log('[aiExtraction] Groq daily limit reached — skipping');
  }

  // 3. HuggingFace
  if (await isProviderAvailable('huggingface')) {
    try {
      console.log('[aiExtraction] Trying HuggingFace…');
      const img = await getImage();
      const data = await tryHuggingFace(img);
      await incrementUsage('huggingface');
      console.log('[aiExtraction] ✓ HuggingFace succeeded');
      return { success: true, data, provider: 'huggingface' };
    } catch (err) {
      console.warn('[aiExtraction] HuggingFace failed:', (err as Error).message);
    }
  } else {
    console.log('[aiExtraction] HuggingFace daily limit reached — skipping');
  }

  // 4. Together AI
  if (await isProviderAvailable('together')) {
    try {
      console.log('[aiExtraction] Trying Together AI…');
      const img = await getImage();
      const data = await tryTogether(img);
      await incrementUsage('together');
      console.log('[aiExtraction] ✓ Together AI succeeded');
      return { success: true, data, provider: 'together' };
    } catch (err) {
      console.warn('[aiExtraction] Together AI failed:', (err as Error).message);
    }
  } else {
    console.log('[aiExtraction] Together AI daily limit reached — skipping');
  }

  // All providers exhausted
  console.error('[aiExtraction] All providers failed or exhausted for today');
  return {
    success: false,
    fallbackToManual: true,
    message:
      'All AI providers are currently unavailable or have reached their daily limit. ' +
      'Please fill in the policy details manually.',
  };
}
