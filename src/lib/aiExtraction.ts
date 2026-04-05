/**
 * aiExtraction.ts
 *
 * Multi-provider PDF policy extractor with automatic fallback.
 *
 * ─── ACTIVE STRATEGY (TESTING) ───────────────────────────────────────────────
 * PDF → plain text (first 5 pages via pdfjs-dist) → sent to LLM as text prompt.
 * Providers tested in the same fallback order as before.
 *
 * ─── ORIGINAL STRATEGY (commented out below) ─────────────────────────────────
 * Fallback order:
 *   1. Gemini 2.5 Flash Lite  — native PDF support, primary provider
 *   2. Groq (Llama 4 Scout)   — vision via PDF→JPEG conversion
 *   3. HuggingFace (Llama 3.2 Vision) — vision via PDF→JPEG conversion
 *   4. Together AI (Llama 3.2 Vision Turbo) — vision via PDF→JPEG conversion
 *
 * Each provider is skipped when:
 *   a) its API key is not configured, OR
 *   b) its daily usage budget is exhausted (tracked in MongoDB via providerUsage.ts), OR
 *   c) the Redis sliding-window rate limit says to wait (throttleManager.ts)
 *
 * If all providers fail, returns { success: false, fallbackToManual: true }.
 */

import { isProviderAvailable, incrementUsage } from '@/lib/providerUsage';
import {
  getWaitMs,
  recordRequest,
  markCoolingDown,
} from '@/lib/throttleManager';

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



// ─── [ORIGINAL] PDF → JPEG base64 conversion (pdfjs-dist + @napi-rs/canvas) ──
// Commented out — restore when switching back to the image-based strategy.

async function pdfToJpegBase64(pdfBuffer: Buffer): Promise<string> {
  // Use the legacy build — it polyfills DOMMatrix and other browser APIs
  // that the default "build/pdf.mjs" requires but Node.js doesn't provide.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const { resolve } = await import('path');

  // pdfjs v5 no longer accepts an empty workerSrc — we must point it to the
  // actual worker bundle via a file:// URL so Node.js can load it directly.
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${resolve(
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  )}`;

  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context, viewport }).promise;
  await pdfDoc.destroy();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jpegBuffer = await (canvas as any).encode('jpeg', 85) as Buffer;
  return jpegBuffer.toString('base64');
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

// ─── Image-based provider implementations ───────────

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

  if (res.status === 429) {
    await markCoolingDown('gemini');
    throw new Error(`Gemini 429: rate limited`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Gemini returned empty response');
  return parseJsonResponse(raw);
}

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

  if (res.status === 429) {
    await markCoolingDown('groq');
    throw new Error(`Groq 429: rate limited`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Groq returned empty response');
  return parseJsonResponse(raw);
}

async function tryHuggingFace(jpegBase64: string): Promise<unknown> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not configured');

  const provider = process.env.HF_PROVIDER ?? 'fireworks-ai';
  const model = process.env.HF_MODEL ?? 'Qwen/Qwen2.5-VL-7B-Instruct';

  const res = await fetch(
    `https://router.huggingface.co/${provider}/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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

  if (res.status === 429) {
    await markCoolingDown('huggingface');
    throw new Error(`HuggingFace 429: rate limited`);
  }

  if (res.status === 403) {
    await markCoolingDown('huggingface');
    throw new Error(
      `HuggingFace 403: token missing Inference Providers permission — ` +
      `regenerate at huggingface.co/settings/tokens`
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HuggingFace ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('HuggingFace returned empty response');
  return parseJsonResponse(raw);
}

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

  if (res.status === 429) {
    await markCoolingDown('together');
    throw new Error(`Together AI 429: rate limited`);
  }

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
 * [TESTING — TEXT STRATEGY]
 * Extracts insurance policy data from a PDF buffer by first converting the
 * first 5 pages to plain text, then feeding that text to each LLM provider
 * in fallback order (Gemini → Groq → HuggingFace → Together).
 *
 * To restore the original image-based pipeline:
 *   1. Uncomment the original provider functions above (tryGemini, tryGroq, etc.)
 *   2. Uncomment pdfToJpegBase64 above
 *   3. Replace the body of this function with the commented-out ORIGINAL block below
 */
export async function extractPolicyData(pdfBuffer: Buffer): Promise<ExtractionResult> {
  let jpegBase64: string | null = null;

  async function getImage(): Promise<string> {
    if (!jpegBase64) {
      jpegBase64 = await pdfToJpegBase64(pdfBuffer);
    }
    return jpegBase64;
  }

  // 1. Gemini — native PDF support
  if (await isProviderAvailable('gemini')) {
    const waitMs = await getWaitMs('gemini');
    if (waitMs > 0) {
      console.log(`[aiExtraction] Gemini throttled — wait ${waitMs}ms — skipping`);
    } else {
      try {
        console.log('[aiExtraction] Trying Gemini…');
        const data = await tryGemini(pdfBuffer);
        await recordRequest('gemini');
        await incrementUsage('gemini');
        console.log('[aiExtraction] ✓ Gemini succeeded');
        return { success: true, data, provider: 'gemini' };
      } catch (err) {
        console.warn('[aiExtraction] Gemini failed:', (err as Error).message);
      }
    }
  } else {
    console.log('[aiExtraction] Gemini daily limit reached — skipping');
  }

  // 2. Groq — vision via PDF→JPEG
  if (await isProviderAvailable('groq')) {
    const waitMs = await getWaitMs('groq');
    if (waitMs > 0) {
      console.log(`[aiExtraction] Groq throttled — wait ${waitMs}ms — skipping`);
    } else {
      try {
        console.log('[aiExtraction] Trying Groq…');
        const img = await getImage();
        const data = await tryGroq(img);
        await recordRequest('groq');
        await incrementUsage('groq');
        console.log('[aiExtraction] ✓ Groq succeeded');
        return { success: true, data, provider: 'groq' };
      } catch (err) {
        console.warn('[aiExtraction] Groq failed:', (err as Error).message);
      }
    }
  } else {
    console.log('[aiExtraction] Groq daily limit reached — skipping');
  }

  // 3. HuggingFace — vision via PDF→JPEG
  if (await isProviderAvailable('huggingface')) {
    const waitMs = await getWaitMs('huggingface');
    if (waitMs > 0) {
      console.log(`[aiExtraction] HuggingFace throttled — wait ${waitMs}ms — skipping`);
    } else {
      try {
        console.log('[aiExtraction] Trying HuggingFace…');
        const img = await getImage();
        const data = await tryHuggingFace(img);
        await recordRequest('huggingface');
        await incrementUsage('huggingface');
        console.log('[aiExtraction] ✓ HuggingFace succeeded');
        return { success: true, data, provider: 'huggingface' };
      } catch (err) {
        console.warn('[aiExtraction] HuggingFace failed:', (err as Error).message);
      }
    }
  } else {
    console.log('[aiExtraction] HuggingFace daily limit reached — skipping');
  }

  // 4. Together AI — vision via PDF→JPEG
  if (await isProviderAvailable('together')) {
    const waitMs = await getWaitMs('together');
    if (waitMs > 0) {
      console.log(`[aiExtraction] Together AI throttled — wait ${waitMs}ms — skipping`);
    } else {
      try {
        console.log('[aiExtraction] Trying Together AI…');
        const img = await getImage();
        const data = await tryTogether(img);
        await recordRequest('together');
        await incrementUsage('together');
        console.log('[aiExtraction] ✓ Together AI succeeded');
        return { success: true, data, provider: 'together' };
      } catch (err) {
        console.warn('[aiExtraction] Together AI failed:', (err as Error).message);
      }
    }
  } else {
    console.log('[aiExtraction] Together AI daily limit reached — skipping');
  }

  console.error('[aiExtraction] All providers failed or exhausted for today');
  return {
    success: false,
    fallbackToManual: true,
    message:
      'All AI providers are currently unavailable or have reached their daily limit. ' +
      'Please fill in the policy details manually.',
  };
}
