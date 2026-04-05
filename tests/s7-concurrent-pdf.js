// tests/s7-concurrent-pdf.js
//
// Scenario 7: 20 agents each upload 1 PDF simultaneously
//
// This is the EXACT real-world scenario:
//   - 20 logged-in agents, each using the single-upload UI
//   - Each sends 1 PDF to /api/extract-policy at the same moment
//   - Total: 20 concurrent POST /api/extract-policy requests
//
// What this reveals:
//   1. Which requests Gemini accepts vs 429-rejects (15 RPM hard limit)
//   2. Whether the throttleManager/aiExtraction fallback chain works
//   3. Whether users get a usable response (200 or graceful 503) vs a crash
//   4. How fast the endpoint responds under concurrent load
//
// Note: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN must be set
// in .env.local for throttleManager to function. If they are empty,
// aiExtraction falls back to calling Gemini directly with no throttle guard.

import { BASE_URL, ResultStore, sleep } from './config.js';

// ── Proper PDF with text content + accurate xref byte offsets ─────────────────
//
// Bug #1 fixed: original PDF had NO content stream (blank page).
//   Vision models (Groq/HuggingFace/Together) received a blank white JPEG,
//   returned unstructured text → JSON.parse() failed → every fallback threw.
//
// Bug #2 fixed: original had hardcoded xref offsets (9, 58, 115) that did
//   not match the actual string lengths → pdfjs-dist rejected the PDF for
//   image conversion used by the fallback providers.
//
// This generator calculates exact byte offsets dynamically and embeds a
// real insurance policy text so vision models can extract structured JSON.
function makeTestPdf() {
  // Content stream: a Motor policy with all key fields
  const contentText =
    'BT /F1 11 Tf\n' +
    '50 740 Td (MOTOR INSURANCE POLICY CERTIFICATE) Tj\n' +
    '0 -22 Td (Policy Number: MOT-2024-TEST-001) Tj\n' +
    '0 -22 Td (Insured Name: Rahul Sharma) Tj\n' +
    '0 -22 Td (Phone: 9876543210) Tj\n' +
    '0 -22 Td (Vehicle: Maruti Suzuki Swift Dezire 2022) Tj\n' +
    '0 -22 Td (Registration: MH12AB9999) Tj\n' +
    '0 -22 Td (Fuel Type: Petrol  Engine: 1200 CC) Tj\n' +
    '0 -22 Td (IDV: Rs. 450000   NCB: 20%) Tj\n' +
    '0 -22 Td (Sum Insured: Rs. 450000) Tj\n' +
    '0 -22 Td (Premium: Rs. 12500) Tj\n' +
    '0 -22 Td (Start Date: 2024-04-01   End Date: 2025-03-31) Tj\n' +
    '0 -22 Td (Add-ons: Zero Depreciation, Roadside Assistance) Tj\n' +
    'ET\n';

  // Build PDF objects with exact byte-length awareness
  const obj1 = '1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n';
  const obj2 = '2 0 obj\n<</Type /Pages /Kids[3 0 R] /Count 1>>\nendobj\n';
  const obj3 =
    '3 0 obj\n' +
    '<</Type /Page /Parent 2 0 R /MediaBox[0 0 612 792]\n' +
    '/Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>\n' +
    'endobj\n';
  const obj4 =
    `4 0 obj\n<</Length ${contentText.length}>>\nstream\n${contentText}endstream\nendobj\n`;
  const obj5 =
    '5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n';

  const header = '%PDF-1.4\n';

  // Calculate byte offsets — these must be exact
  const off1 = header.length;
  const off2 = off1 + obj1.length;
  const off3 = off2 + obj2.length;
  const off4 = off3 + obj3.length;
  const off5 = off4 + obj4.length;

  const body = header + obj1 + obj2 + obj3 + obj4 + obj5;

  // xref table — xrefStart is the byte offset of the xref keyword
  const xrefStart = body.length;
  const xref =
    'xref\n0 6\n' +
    '0000000000 65535 f\r\n' +
    String(off1).padStart(10, '0') + ' 00000 n\r\n' +
    String(off2).padStart(10, '0') + ' 00000 n\r\n' +
    String(off3).padStart(10, '0') + ' 00000 n\r\n' +
    String(off4).padStart(10, '0') + ' 00000 n\r\n' +
    String(off5).padStart(10, '0') + ' 00000 n\r\n';

  const trailer = `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'utf8');
}

// ── Run ───────────────────────────────────────────────────────────────────────
export async function runConcurrentPdfScenario(sessions) {
  console.log('\n━━━ Scenario 7: 20 Concurrent Real PDF Uploads (1 per agent) ━━━');
  console.log('  PDF: Motor policy with full text content (vision models can read it)');
  console.log('  Firing all 20 simultaneously\n');

  const store    = new ResultStore('S7 - 20 Concurrent PDF Uploads');
  const pdfBytes = makeTestPdf();
  console.log(`  Test PDF size: ${pdfBytes.length} bytes\n`);
  const start    = Date.now();

  if (sessions.length < 20) {
    console.log(`  ⚠  Only ${sessions.length} sessions available — using all`);
  }

  // ── Fire all 20 simultaneously ─────────────────────────────────────────────
  const uploadPromises = sessions.map(async (session) => {
    const agentIdx = session.agent.index;
    const t0 = Date.now();

    try {
      const fd = new FormData();
      fd.append(
        'pdf',
        new Blob([pdfBytes], { type: 'application/pdf' }),
        `policy-agent${agentIdx}.pdf`
      );

      const res  = await fetch(`${BASE_URL}/api/extract-policy`, {
        method: 'POST',
        headers: { Cookie: session.sessionCookie },
        body: fd,
      });

      const ms   = Date.now() - t0;
      const body = await res.json().catch(() => ({}));

      const status   = res.status;
      const ok       = status === 200;
      const provider = body?.provider ?? null;
      const fallback = body?.fallbackToManual ?? false;
      // Capture the full raw error for diagnosis
      const errorMsg = body?.error ?? body?.message ?? JSON.stringify(body) ?? null;

      store.record(
        `POST /api/extract-policy (agent ${agentIdx})`,
        ms,
        status,
        ok,
        ok ? `provider=${provider}` : (fallback ? 'fallbackToManual' : (errorMsg ?? 'err'))
      );

      let icon;
      if (status === 200)      icon = '✅';
      else if (status === 429) icon = '🔴 RATE LIMITED';
      else if (status === 503) icon = '🟡 503';
      else                     icon = `❌ ${status}`;

      // Always print the full error message so we can diagnose fallback failures
      const detail = ok
        ? `[${provider}]`
        : (fallback ? `fallbackToManual — "${errorMsg}"` : `"${errorMsg}"`);

      console.log(`  Agent ${String(agentIdx).padStart(2)}: ${ms}ms — ${icon} ${detail}`);

      return { agentIdx, ms, status, ok, provider, fallback, error: errorMsg };

    } catch (err) {
      const ms = Date.now() - t0;
      store.record(`POST /api/extract-policy (agent ${agentIdx})`, ms, 0, false, err.message);
      console.log(`  Agent ${String(agentIdx).padStart(2)}: ${ms}ms — 💥 NETWORK ERROR: ${err.message}`);
      return { agentIdx, ms, status: 0, ok: false, provider: null, fallback: false, error: err.message };
    }
  });

  const results = await Promise.all(uploadPromises);
  const wallMs  = Date.now() - start;

  // ── Analyse results ────────────────────────────────────────────────────────
  const succeeded       = results.filter(r => r.status === 200);
  const rateLimited429  = results.filter(r => r.status === 429);
  const graceful503     = results.filter(r => r.status === 503);
  const networkErrors   = results.filter(r => r.status === 0);
  const otherErrors     = results.filter(r => ![0, 200, 429, 503].includes(r.status));

  const byProvider = {};
  for (const r of succeeded) {
    byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
  }

  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const p50   = times[Math.floor(times.length / 2)];
  const p95   = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];

  console.log(`
┌────────────────────────────────────────────────────────────┐
│           S7 — CONCURRENT PDF UPLOAD SUMMARY               │
├────────────────────────────────────────────────────────────┤
│  Total fired:        20 simultaneous uploads               │
│  Wall time:          ${String(wallMs).padEnd(6)}ms                            │
│  p50 response:       ${String(p50).padEnd(6)}ms                            │
│  p95 response:       ${String(p95).padEnd(6)}ms                            │
├────────────────────────────────────────────────────────────┤
│  ✅ 200 Success:     ${String(succeeded.length).padEnd(2)} / 20                          │
│  🔴 429 Rate limited:${String(rateLimited429.length).padEnd(2)} / 20                          │
│  🟡 503 Fallback:    ${String(graceful503.length).padEnd(2)} / 20 (all providers exhausted) │
│  💥 Network error:   ${String(networkErrors.length).padEnd(2)} / 20                          │
│  ❓ Other:           ${String(otherErrors.length).padEnd(2)} / 20                          │
├────────────────────────────────────────────────────────────┤`);

  if (Object.keys(byProvider).length) {
    console.log('│  Provider breakdown:                                       │');
    for (const [p, c] of Object.entries(byProvider)) {
      console.log(`│    ${p.padEnd(12)} → ${c} successes                              │`);
    }
    console.log('├────────────────────────────────────────────────────────────┤');
  }

  // Verdict
  let verdict;
  if (rateLimited429.length === 0 && succeeded.length === 20) {
    verdict = '🟢 PASS — All 20 handled within limits';
  } else if (rateLimited429.length > 0) {
    verdict = `🔴 ATTENTION — ${rateLimited429.length} raw 429s reached the client\n│     Gemini quota exceeded. ThrottleManager did not prevent\n│     all concurrent calls. Fallback chain needed or Redis\n│     env vars are not set (in-process check only).`;
  } else if (graceful503.length > 0 && rateLimited429.length === 0) {
    verdict = `🟡 DEGRADED — ${graceful503.length} got graceful "fill manually"\n│     ThrottleManager blocked them before hitting Gemini.\n│     Acceptable UX — user sees a clear message.`;
  } else {
    verdict = '🟡 MIXED — see per-agent results above';
  }

  console.log(`│  Verdict: ${verdict.padEnd(49)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');

  // Explain what the scores mean
  console.log('\n  Interpretation:');
  if (rateLimited429.length > 0) {
    console.log('  🔴 Raw 429s reached the client — this means aiExtraction.ts');
    console.log('     called Gemini and got rejected. Two possible causes:');
    console.log('     a) UPSTASH_REDIS_REST_URL/TOKEN not set → throttleManager');
    console.log('        cannot share state, all 20 pass the local getWaitMs()');
    console.log('        check simultaneously → all hit Gemini → 429s');
    console.log('     b) Redis IS set but concurrent reads all see count=0');
    console.log('        before any writes land (TOCTOU race condition).');
    console.log('     Fix: see recommendations at bottom of report.');
  }
  if (graceful503.length > 0) {
    console.log(`  🟡 ${graceful503.length} agents got a graceful "fill manually" response.`);
    console.log('     The fallback chain (Groq/HuggingFace/Together) is either');
    console.log('     not configured (no API keys) or also throttled.');
    console.log('     UX impact: user sees an error banner, can type manually.');
  }
  if (succeeded.length > 0) {
    console.log(`  ✅ ${succeeded.length} extractions succeeded via: ${JSON.stringify(byProvider)}`);
  }

  return store;
}
