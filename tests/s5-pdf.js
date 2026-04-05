// tests/s5-pdf.js
// Scenario 5: AI / PDF extraction endpoint probe (no actual PDF binary needed)
// Tests: rate limiting, 429 handling, queue behavior, serverless timeout risk
//
// We do NOT upload 60 real PDFs (that would burn Gemini quota and take ~6+ minutes).
// Instead, we:
//   1. Send a tiny 1-byte "PDF" to each endpoint to confirm it responds and surfaces
//      our queue/429 handling quickly.
//   2. Send a deliberately malformed request to validate error responses.
//   3. Send a real small PDF (generated inline) to 1 agent to confirm the full
//      extraction pipeline works end-to-end.
//
// The full 60-PDF scenario is documented as a manual test (see report).

import { BASE_URL, ResultStore, timedFetch, sleep } from './config.js';

// Minimal valid PDF (~200 bytes) — a single blank page
function makeMinimalPdf() {
  const pdfStr =
    '%PDF-1.4\n' +
    '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type /Pages /Kids[3 0 R] /Count 1>>endobj\n' +
    '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 612 792]>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n' +
    '0000000115 00000 n\ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF\n';
  return Buffer.from(pdfStr, 'utf8');
}

export async function runPdfScenario(sessions) {
  console.log('\n━━━ Scenario 5: AI Extract-Policy Endpoint Probing ━━━');
  const store = new ResultStore('S5 - PDF Extraction');

  if (!sessions.length) {
    console.log('  ⚠  No sessions — skipping PDF test');
    return store;
  }

  const pdfBytes = makeMinimalPdf();

  // ── Test 1: Unauthenticated request (should 401) ─────────────────────────────
  console.log('\n  Test 1: Unauthenticated request (expect 401)...');
  {
    const fd = new FormData();
    fd.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'test.pdf');
    const { res, ms } = await timedFetch(
      store,
      'POST /api/extract-policy (unauth)',
      `${BASE_URL}/api/extract-policy`,
      { method: 'POST', body: fd }
    );
    console.log(`    Result: ${ms}ms — status=${res?.status} ${res?.status === 401 ? '✓ correct' : '✗ unexpected'}`);
  }

  // ── Test 2: Empty body (should 400) ─────────────────────────────────────────
  console.log('  Test 2: Empty body (expect 400)...');
  {
    const session = sessions[0];
    const fd = new FormData();
    // No PDF appended
    const { res, ms } = await timedFetch(
      store,
      'POST /api/extract-policy (empty)',
      `${BASE_URL}/api/extract-policy`,
      { method: 'POST', headers: { Cookie: session.sessionCookie }, body: fd }
    );
    console.log(`    Result: ${ms}ms — status=${res?.status} ${res?.status === 400 ? '✓ correct' : `(got ${res?.status})`}`);
  }

  // ── Test 3: 5 sequential minimal PDFs to probe rate-limit surface ────────────
  console.log('  Test 3: 5 sequential minimal PDF probes (rate-limit boundary)...');
  for (let i = 0; i < 5; i++) {
    const session = sessions[i % sessions.length];
    const fd = new FormData();
    fd.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), `probe-${i}.pdf`);

    const { res, body, ms } = await timedFetch(
      store,
      'POST /api/extract-policy (probe)',
      `${BASE_URL}/api/extract-policy`,
      { method: 'POST', headers: { Cookie: session.sessionCookie }, body: fd }
    );

    let detail = '';
    if (res?.status === 200) detail = `provider=${body?.provider ?? 'unknown'}`;
    if (res?.status === 429) detail = '429 RATE LIMITED ← queue should catch this';
    if (res?.status === 503) detail = `503 fallbackToManual=${body?.fallbackToManual}`;

    console.log(`    Probe ${i + 1}: ${ms}ms — status=${res?.status} ${detail}`);

    // Small gap between probes to avoid exhausting the key in testing
    if (i < 4) await sleep(5000);
  }

  // ── Test 4: 20 simultaneous invalid body uploads (load without quota burn) ───
  console.log('\n  Test 4: 20 concurrent non-PDF requests (no quota burn, load only)...');
  const concurrent20 = sessions.map(async (session, i) => {
    const fd = new FormData();
    // Send a text file instead of a PDF — API should still respond quickly
    fd.append('pdf', new Blob(['not a real pdf'], { type: 'text/plain' }), `fake-${i}.pdf`);
    const { res, ms } = await timedFetch(
      store,
      'POST /api/extract-policy (concurrent fake)',
      `${BASE_URL}/api/extract-policy`,
      { method: 'POST', headers: { Cookie: session.sessionCookie }, body: fd }
    );
    return { agent: session.agent.index, ms, status: res?.status };
  });

  const results = await Promise.all(concurrent20);
  const statuses = results.map(r => r.status).reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1; return acc;
  }, {});
  console.log(`    Status distribution: ${JSON.stringify(statuses)}`);
  console.log(`    Response times: [${results.map(r => r.ms + 'ms').join(', ')}]`);

  return store;
}
