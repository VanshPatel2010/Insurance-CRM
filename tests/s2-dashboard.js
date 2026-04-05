// tests/s2-dashboard.js
// Scenario 2: 20 concurrent dashboard loads (stats API + customer list)
// Tests: MongoDB aggregation, paginated queries, agentId scoping

import { BASE_URL, ResultStore, timedFetch } from './config.js';

export async function runDashboardScenario(sessions) {
  console.log('\n━━━ Scenario 2: Dashboard Load (20 concurrent) ━━━');
  const store = new ResultStore('S2 - Dashboard Load');

  if (!sessions.length) {
    console.log('  ⚠  No sessions available — skipping dashboard test');
    return store;
  }

  async function loadDashboard(session) {
    const cookie = session.sessionCookie;
    const idx = session.agent.index;

    // 1. Hit the dashboard stats endpoint
    const { ms: statsMs, res: statsRes } = await timedFetch(
      store,
      'GET /api/dashboard',
      `${BASE_URL}/api/dashboard`,
      { headers: { Cookie: cookie } }
    );

    // 2. Fetch first page of customers
    const { ms: custMs, res: custRes } = await timedFetch(
      store,
      'GET /api/customers',
      `${BASE_URL}/api/customers?page=1&limit=50`,
      { headers: { Cookie: cookie } }
    );

    // 3. Search within customers
    const { ms: searchMs } = await timedFetch(
      store,
      'GET /api/customers?search=test',
      `${BASE_URL}/api/customers?search=test&page=1&limit=50`,
      { headers: { Cookie: cookie } }
    );

    // 4. Filter by type
    const { ms: filterMs } = await timedFetch(
      store,
      'GET /api/customers?type=motor',
      `${BASE_URL}/api/customers?type=motor&page=1&limit=50`,
      { headers: { Cookie: cookie } }
    );

    console.log(
      `  [S2] Agent ${String(idx).padStart(2)}: ` +
      `stats=${statsMs}ms(${statsRes?.status}) ` +
      `list=${custMs}ms(${custRes?.status}) ` +
      `search=${searchMs}ms filter=${filterMs}ms`
    );
  }

  await Promise.all(sessions.map(s => loadDashboard(s)));
  return store;
}
