// tests/run-local-pdf-test.js
// ─────────────────────────────────────────────────────────────────────────────
// Localhost load test: 20 concurrent PDF uploads against http://localhost:3000
//
// Usage:  node tests/run-local-pdf-test.js
//
// Prereqs:
//  1. `npm run dev` is running on port 3000
//  2. All 20 test accounts (testagent1@insurancecrm.test … testagent20@…)
//     exist in the dev / production database.
//     If they don't, run: node tests/create-test-agents.js first.
// ─────────────────────────────────────────────────────────────────────────────

import { TEST_AGENTS, ResultStore, sleep } from './config.js';
import { generateReport } from './reporter.js';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookies(headers) {
  const cookies = {};
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') ?? ''];
  for (const str of raw) {
    if (!str) continue;
    const parts = str.split(';')[0].split('=');
    const name  = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

// ── Test PDF generator (same as s7-concurrent-pdf.js) ────────────────────────

function makeTestPdf() {
  const pdfPath = path.join(process.cwd(), 'tests', 'Tata AIG Motor Policy Schedule_undefined_6206090456-00.pdf');
  return fs.readFileSync(pdfPath);
}

// ── S1: Login 20 agents against localhost ─────────────────────────────────────

async function loginAll() {
  console.log('\n━━━ Step 1: Authenticating 20 agents against localhost:3000 ━━━\n');
  const store = new ResultStore('S1 - Auth (localhost)');

  async function loginOne(agent) {
    // Get CSRF token
    let csrfToken, csrfCookieStr;
    try {
      const r = await fetch(`${BASE}/api/auth/csrf`);
      const d = await r.json();
      csrfToken     = d.csrfToken;
      csrfCookieStr = r.headers.get('set-cookie') ?? '';
    } catch (e) {
      console.log(`  Agent ${String(agent.index).padStart(2)}: ✗ CSRF fetch failed — ${e.message}`);
      return { agent, sessionCookie: null, ok: false };
    }

    const csrfCookieValue = csrfCookieStr.split(';')[0] ?? '';

    // POST credentials
    const t = Date.now();
    let callbackRes;
    try {
      callbackRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookieValue,
        },
        body: new URLSearchParams({
          csrfToken,
          email:       agent.email,
          password:    agent.password,
          callbackUrl: `${BASE}/dashboard`,
          json:        'true',
        }).toString(),
        redirect: 'manual',
      });
    } catch (e) {
      console.log(`  Agent ${String(agent.index).padStart(2)}: ✗ login POST failed — ${e.message}`);
      return { agent, sessionCookie: null, ok: false };
    }

    const loginMs = Date.now() - t;
    const setCookies = extractCookies(callbackRes.headers);

    // In dev (HTTP), the cookie is "next-auth.session-token" (no __Secure- prefix)
    const sessionToken =
      setCookies['next-auth.session-token'] ||
      setCookies['__Secure-next-auth.session-token'];

    const cookieName = setCookies['__Secure-next-auth.session-token']
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const sessionCookie = sessionToken ? `${cookieName}=${sessionToken}` : null;

    if (sessionCookie) {
      store.record('POST /api/auth/callback/credentials', loginMs, callbackRes.status, true, 'ok');
      console.log(`  Agent ${String(agent.index).padStart(2)}: ✅ ${loginMs}ms (${callbackRes.status}) — session captured`);
      return { agent, sessionCookie, ok: true };
    }

    // Fallback: try verifying session via CSRF cookie (json:true mode)
    if (callbackRes.status === 200) {
      const sessionRes = await fetch(`${BASE}/api/auth/session`, {
        headers: { Cookie: csrfCookieValue },
      }).catch(() => null);
      const sessionData = await sessionRes?.json().catch(() => null);
      if (sessionData?.user) {
        store.record('POST /api/auth/callback/credentials', loginMs, 200, true, 'csrf-fallback');
        console.log(`  Agent ${String(agent.index).padStart(2)}: ✅ ${loginMs}ms — session via CSRF cookie`);
        return { agent, sessionCookie: csrfCookieValue, ok: true };
      }
    }

    store.record('POST /api/auth/callback/credentials', loginMs, callbackRes.status, false, 'no session cookie');
    console.log(
      `  Agent ${String(agent.index).padStart(2)}: ✗ ${loginMs}ms (${callbackRes.status}) — ` +
      `no session (cookies: ${Object.keys(setCookies).join(',') || 'none'})`
    );
    return { agent, sessionCookie: null, ok: false };
  }

  const results = await Promise.all(TEST_AGENTS.map(loginOne));
  const sessions = results.filter(r => r.ok && r.sessionCookie);
  console.log(`\n  Sessions obtained: ${sessions.length}/20`);
  return { store, sessions };
}

// ── S7: Fire all 20 PDF uploads simultaneously ────────────────────────────────

async function runConcurrentPdf(sessions) {
  console.log('\n━━━ Step 2: 20 Concurrent PDF Uploads → localhost:3000 ━━━');
  console.log('  Firing all simultaneously — watch the dev server logs!\n');

  const store    = new ResultStore('S7 - 20 Concurrent PDF Uploads (localhost)');
  const pdfBytes = makeTestPdf();
  console.log(`  PDF size: ${pdfBytes.length} bytes\n`);
  const wallStart = Date.now();

  const uploadPromises = sessions.map(async (session) => {
    const idx = session.agent.index;
    const t0  = Date.now();

    try {
      const fd = new FormData();
      fd.append(
        'pdf',
        new Blob([pdfBytes], { type: 'application/pdf' }),
        `policy-agent${idx}.pdf`
      );

      const res  = await fetch(`${BASE}/api/extract-policy`, {
        method:  'POST',
        headers: { Cookie: session.sessionCookie },
        body:    fd,
      });

      const ms     = Date.now() - t0;
      const body   = await res.json().catch(() => ({}));
      const ok     = res.status === 200;
      const provider  = body?.provider ?? null;
      const fallback  = body?.fallbackToManual ?? false;
      const errorMsg  = body?.error ?? body?.message ?? null;

      store.record(
        `POST /api/extract-policy`,
        ms, res.status, ok,
        ok ? `provider=${provider}` : (fallback ? 'fallbackToManual' : errorMsg ?? 'err')
      );

      let icon;
      if (ok)               icon = `✅ [${provider}]`;
      else if (res.status === 429) icon = '🔴 429 RATE-LIMITED';
      else if (res.status === 503) icon = '🟡 503 fallback→manual';
      else                  icon = `❌ ${res.status}`;

      const detail = ok ? '' : ` — "${errorMsg ?? 'no message'}"`;
      console.log(`  Agent ${String(idx).padStart(2)}: ${ms}ms — ${icon}${detail}`);

      return { idx, ms, status: res.status, ok, provider, fallback, error: errorMsg };
    } catch (err) {
      const ms = Date.now() - t0;
      store.record('POST /api/extract-policy', ms, 0, false, err.message);
      console.log(`  Agent ${String(idx).padStart(2)}: ${ms}ms — 💥 ${err.message}`);
      return { idx, ms, status: 0, ok: false, provider: null, fallback: false, error: err.message };
    }
  });

  const results  = await Promise.all(uploadPromises);
  const wallMs   = Date.now() - wallStart;

  // ── Summary ─────────────────────────────────────────────────────────────────
  const succeeded  = results.filter(r => r.status === 200);
  const rl429      = results.filter(r => r.status === 429);
  const graceful503= results.filter(r => r.status === 503);
  const netErr     = results.filter(r => r.status === 0);
  const other      = results.filter(r => ![0,200,429,503].includes(r.status));

  const byProvider = {};
  for (const r of succeeded) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;

  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const p50   = times[Math.floor(times.length / 2)];
  const p95   = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];

  console.log(`
┌──────────────────────────────────────────────────────────────┐
│         S7 — CONCURRENT PDF UPLOAD SUMMARY (localhost)       │
├──────────────────────────────────────────────────────────────┤
│  Total fired:         20 simultaneous uploads                │
│  Wall time:           ${String(wallMs + 'ms').padEnd(8)}                         │
│  p50 response:        ${String(p50 + 'ms').padEnd(8)}                         │
│  p95 response:        ${String(p95 + 'ms').padEnd(8)}                         │
├──────────────────────────────────────────────────────────────┤
│  ✅ 200 Success:      ${String(succeeded.length).padEnd(2)} / 20                           │
│  🔴 429 Rate limited: ${String(rl429.length).padEnd(2)} / 20                           │
│  🟡 503 Fallback:     ${String(graceful503.length).padEnd(2)} / 20 (all providers exhausted)  │
│  💥 Network error:    ${String(netErr.length).padEnd(2)} / 20                           │
│  ❓ Other:            ${String(other.length).padEnd(2)} / 20                           │
├──────────────────────────────────────────────────────────────┤`);

  if (Object.keys(byProvider).length) {
    console.log('│  Provider breakdown:                                         │');
    for (const [p, c] of Object.entries(byProvider)) {
      console.log(`│    ${p.padEnd(14)} → ${c} requests                             │`);
    }
    console.log('├──────────────────────────────────────────────────────────────┤');
  }

  let verdict;
  if (succeeded.length === sessions.length && rl429.length === 0) {
    verdict = '🟢 PASS — All requests handled successfully';
  } else if (rl429.length > 0) {
    verdict = `🔴 ${rl429.length} raw 429s — throttle not blocking all concurrent calls`;
  } else if (graceful503.length > 0 && rl429.length === 0) {
    verdict = `🟡 ${graceful503.length} graceful fallbacks — providers rate-limited`;
  } else {
    verdict = '🟡 MIXED — see per-agent results';
  }

  console.log(`│  Verdict: ${verdict}`);
  console.log('└──────────────────────────────────────────────────────────────┘\n');

  return store;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   🏋️  Insurance CRM — Localhost Concurrent PDF Load Test      ║');
console.log('║   Target: http://localhost:3000                               ║');
console.log('║   Users:  20 concurrent test agents                          ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// Check localhost reachability
console.log('⏳ Checking localhost:3000...');
try {
  const probe = await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(5000) });
  console.log(`✅ Server reachable — HTTP ${probe.status}\n`);
} catch (err) {
  console.error(`❌ localhost:3000 not reachable: ${err.message}`);
  console.error('   Make sure `npm run dev` is running first.');
  process.exit(1);
}

// Step 1: login
const { store: authStore, sessions } = await loginAll();

if (sessions.length === 0) {
  console.error('\n❌ No sessions obtained — cannot run PDF test.');
  console.error('   Make sure test accounts exist (run: node tests/create-test-agents.js)');
  process.exit(1);
}

await sleep(500);

// Step 2: fire PDFs
const pdfStore = await runConcurrentPdf(sessions);

// Step 3: report
console.log('\n━━━ Generating Report ━━━');
const { mdPath } = generateReport(
  [authStore.summary(), pdfStore.summary()],
  './tests/results'
);
console.log(`\n  📝 Full report → ${mdPath}\n`);
