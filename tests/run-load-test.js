// tests/run-load-test.js
// ─────────────────────────────────────────────────────────────────────────────
// Insurance CRM — Full Load Test Runner
// Runs all 6 scenarios sequentially (sessions from S1 feed into S2–S6)
// Usage: node tests/run-load-test.js [--scenario <1-6>] [--skip-pdf]
// ─────────────────────────────────────────────────────────────────────────────

import { runAuthScenario }      from './s1-auth.js';
import { runDashboardScenario } from './s2-dashboard.js';
import { runCrudScenario }      from './s3-crud.js';
import { runSearchScenario }    from './s4-search.js';
import { runPdfScenario }       from './s5-pdf.js';
import { runPageSpeedScenario } from './s6-pagespeed.js';
import { generateReport }       from './reporter.js';
import { BASE_URL, sleep }      from './config.js';

const args = process.argv.slice(2);
const onlyScenario = args.includes('--scenario')
  ? parseInt(args[args.indexOf('--scenario') + 1], 10)
  : null;
const skipPdf = args.includes('--skip-pdf');

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║       🏋️  Insurance CRM — Production Load Test Suite           ║');
console.log('║       Target: ' + BASE_URL.padEnd(48) + '║');
console.log('║       Users:  20 concurrent test agents                       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

const allSummaries = [];

// ── Verify target is reachable ────────────────────────────────────────────────
console.log(`⏳ Checking ${BASE_URL} is reachable...`);
try {
  const probe = await fetch(`${BASE_URL}/api/auth/csrf`, { signal: AbortSignal.timeout(10000) });
  console.log(`✅ Target reachable — HTTP ${probe.status}\n`);
} catch (err) {
  console.error(`❌ Target unreachable: ${err.message}`);
  console.error('   Check the URL or your internet connection and retry.');
  process.exit(1);
}

// ── S1: Authentication ────────────────────────────────────────────────────────
let sessions = [];
if (!onlyScenario || onlyScenario === 1) {
  const { store, sessions: s } = await runAuthScenario();
  sessions = s;
  allSummaries.push(store.summary());
  console.log(`\n  ✅ S1 complete — ${sessions.length}/20 sessions obtained`);
  await sleep(2000);
}

// ── S6: Page Speed (run early, no auth needed for public routes) ──────────────
if (!onlyScenario || onlyScenario === 6) {
  const store = await runPageSpeedScenario(sessions);
  allSummaries.push(store.summary());
  console.log('\n  ✅ S6 complete');
  await sleep(2000);
}

// ── S2: Dashboard Load ────────────────────────────────────────────────────────
if ((!onlyScenario || onlyScenario === 2) && sessions.length) {
  const store = await runDashboardScenario(sessions);
  allSummaries.push(store.summary());
  console.log('\n  ✅ S2 complete');
  await sleep(2000);
}

// ── S3: CRUD Operations ───────────────────────────────────────────────────────
if ((!onlyScenario || onlyScenario === 3) && sessions.length) {
  const store = await runCrudScenario(sessions);
  allSummaries.push(store.summary());
  console.log('\n  ✅ S3 complete');
  await sleep(2000);
}

// ── S4: Search & Filter ───────────────────────────────────────────────────────
if ((!onlyScenario || onlyScenario === 4) && sessions.length) {
  const store = await runSearchScenario(sessions);
  allSummaries.push(store.summary());
  console.log('\n  ✅ S4 complete');
  await sleep(2000);
}

// ── S5: PDF Extraction Probe ──────────────────────────────────────────────────
if ((!onlyScenario || onlyScenario === 5) && !skipPdf && sessions.length) {
  const store = await runPdfScenario(sessions);
  allSummaries.push(store.summary());
  console.log('\n  ✅ S5 complete');
} else if (skipPdf) {
  console.log('\n  ⏭  S5 (PDF) — skipped via --skip-pdf flag');
}

// ── Generate Report ───────────────────────────────────────────────────────────
if (allSummaries.length) {
  console.log('\n━━━ Generating Report ━━━');
  const { mdPath, jsonPath } = generateReport(allSummaries);

  // Print quick console summary
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    🎯 QUICK RESULTS SUMMARY                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  for (const s of allSummaries) {
    const pct = parseFloat(s.successRate);
    const icon = pct === 100 ? '🟢' : pct >= 90 ? '🟡' : '🔴';
    console.log(
      `  ${icon} ${s.scenario.padEnd(35)} ` +
      `p50=${String(s.p50).padStart(5)}ms  p95=${String(s.p95).padStart(5)}ms  ` +
      `success=${s.successRate}  errors=${s.errorCount}`
    );
  }
  console.log('');
  console.log(`  Full report → ${mdPath}`);
  console.log('');
}
