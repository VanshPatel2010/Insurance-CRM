// tests/config.js
// Shared configuration for all load test scenarios

export const BASE_URL = 'https://insurance-crm-in.vercel.app';

// 20 pre-created test accounts
export const TEST_AGENTS = Array.from({ length: 20 }, (_, i) => ({
  email: `testagent${i + 1}@insurancecrm.test`,
  password: 'TestPass@123',
  name: `Test Agent ${i + 1}`,
  agencyName: `Test Agency ${i + 1}`,
  index: i + 1,
}));

// Timing helpers
export function now() {
  return Date.now();
}

export function elapsed(startMs) {
  return Date.now() - startMs;
}

// Pause helper
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Percentile calculator
export function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

// Result store for a test scenario
export class ResultStore {
  constructor(scenarioName) {
    this.scenarioName = scenarioName;
    this.results = [];
    this.errors = [];
    this.startTime = now();
  }

  record(label, durationMs, statusCode, ok, detail = '') {
    this.results.push({ label, durationMs, statusCode, ok, detail, ts: now() });
    if (!ok) this.errors.push({ label, statusCode, detail });
  }

  summary() {
    const durations = this.results.map(r => r.durationMs).sort((a, b) => a - b);
    const okCount = this.results.filter(r => r.ok).length;
    const errCount = this.results.filter(r => !r.ok).length;
    const totalMs = now() - this.startTime;

    const byLabel = {};
    for (const r of this.results) {
      if (!byLabel[r.label]) byLabel[r.label] = [];
      byLabel[r.label].push(r.durationMs);
    }

    const breakdown = {};
    for (const [label, times] of Object.entries(byLabel)) {
      const sorted = [...times].sort((a, b) => a - b);
      breakdown[label] = {
        count: sorted.length,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        min: sorted[0],
        max: sorted[sorted.length - 1],
      };
    }

    return {
      scenario: this.scenarioName,
      totalRequests: this.results.length,
      successCount: okCount,
      errorCount: errCount,
      successRate: ((okCount / (this.results.length || 1)) * 100).toFixed(1) + '%',
      wallTimeMs: totalMs,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      breakdown,
      errors: this.errors.slice(0, 20), // cap error samples
    };
  }
}

// Fetch with timing + error capture
export async function timedFetch(store, label, url, options = {}) {
  const t = now();
  try {
    const res = await fetch(url, { ...options, redirect: 'follow' });
    const ms = elapsed(t);
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    const ok = res.status >= 200 && res.status < 400;
    store.record(label, ms, res.status, ok, JSON.stringify(body)?.slice(0, 200) ?? '');
    return { res, body, ms, ok };
  } catch (err) {
    const ms = elapsed(t);
    store.record(label, ms, 0, false, err.message);
    return { res: null, body: null, ms, ok: false, err };
  }
}

// Run N async tasks with concurrency cap
export async function runConcurrent(tasks, concurrency = 20) {
  const results = [];
  const queue = [...tasks];

  async function worker() {
    while (queue.length) {
      const task = queue.shift();
      if (task) results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
