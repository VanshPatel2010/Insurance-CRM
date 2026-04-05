// tests/s6-pagespeed.js
// Scenario 6: Page load + TTFB measurement for key routes
// Tests: Vercel cold-start behavior, HTML delivery, static asset caching

import { BASE_URL, ResultStore, timedFetch } from './config.js';

const PUBLIC_ROUTES = [
  { path: '/', label: 'Landing Page' },
  { path: '/login', label: 'Login Page' },
  { path: '/signup', label: 'Signup Page' },
];

const PROTECTED_ROUTES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/dashboard/customers', label: 'Customer List' },
  { path: '/dashboard/customers/new', label: 'Add Customer' },
];

export async function runPageSpeedScenario(sessions) {
  console.log('\n━━━ Scenario 6: Page Load Times (TTFB + HTML delivery) ━━━');
  const store = new ResultStore('S6 - Page Speed');

  // ── Public pages (no auth needed, 10 concurrent hits each) ─────────────────
  console.log('\n  Public pages (10 concurrent hits each):');
  for (const route of PUBLIC_ROUTES) {
    const hits = Array.from({ length: 10 }, () => () =>
      timedFetch(store, route.label, `${BASE_URL}${route.path}`, {
        headers: { Accept: 'text/html' },
      })
    );
    const results = await Promise.all(hits.map(h => h()));
    const times = results.map(r => r.ms).sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
    const statuses = results.map(r => r.res?.status ?? 0);
    console.log(
      `    ${route.label.padEnd(20)} p50=${p50}ms p95=${p95}ms ` +
      `statuses=[${[...new Set(statuses)].join(',')}]`
    );
  }

  // ── Protected pages (with auth cookie, 20 concurrent) ───────────────────────
  if (sessions.length) {
    console.log('\n  Protected pages (20 concurrent, one per session):');
    for (const route of PROTECTED_ROUTES) {
      const results = await Promise.all(
        sessions.map(s =>
          timedFetch(store, route.label, `${BASE_URL}${route.path}`, {
            headers: { Cookie: s.sessionCookie, Accept: 'text/html' },
          })
        )
      );
      const times = results.map(r => r.ms).sort((a, b) => a - b);
      const p50 = times[Math.floor(times.length / 2)];
      const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
      const statuses = [...new Set(results.map(r => r.res?.status ?? 0))];
      console.log(
        `    ${route.label.padEnd(20)} p50=${p50}ms p95=${p95}ms statuses=[${statuses.join(',')}]`
      );
    }
  }

  return store;
}
