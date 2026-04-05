// tests/run-pdf-test.js
// Focused runner: login 20 agents → fire 20 simultaneous PDF uploads → report
// Usage: node tests/run-pdf-test.js

import { runAuthScenario }           from './s1-auth.js';
import { runConcurrentPdfScenario }  from './s7-concurrent-pdf.js';
import { generateReport }            from './reporter.js';
import { BASE_URL, sleep }           from './config.js';

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   🧪 Insurance CRM — 20 Concurrent PDF Upload Test          ║');
console.log(`║   Target: ${BASE_URL.padEnd(49)}║`);
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// Check target
console.log(`⏳ Checking ${BASE_URL} is reachable...`);
try {
  const probe = await fetch(`${BASE_URL}/api/auth/csrf`, { signal: AbortSignal.timeout(10000) });
  console.log(`✅ Target reachable — HTTP ${probe.status}\n`);
} catch (err) {
  console.error(`❌ Target unreachable: ${err.message}`);
  process.exit(1);
}

// Step 1: Login all 20 agents
const { store: authStore, sessions } = await runAuthScenario();
console.log(`\n  ✅ Auth complete — ${sessions.length}/20 sessions ready`);

if (sessions.length === 0) {
  console.error('\n❌ No sessions obtained — cannot run PDF test. Check credentials.');
  process.exit(1);
}

// Brief pause to let any server warm-up settle
await sleep(1000);

// Step 2: Fire 20 PDFs simultaneously
const pdfStore = await runConcurrentPdfScenario(sessions);

// Report
console.log('\n━━━ Generating Report ━━━');
const { mdPath } = generateReport([authStore.summary(), pdfStore.summary()]);
console.log(`\n  Full report → ${mdPath}`);
