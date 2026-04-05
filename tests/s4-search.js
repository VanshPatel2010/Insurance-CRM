// tests/s4-search.js
// Scenario 4: Search & Filter stress test — all 20 users simultaneously
// Tests: MongoDB text regex, index usage, pagination performance

import { BASE_URL, ResultStore, timedFetch } from './config.js';

const SEARCH_TERMS = ['Sharma', 'Kumar', 'Patel', 'Singh', '9876', 'POL-'];
const TYPES = ['motor', 'medical', 'fire', 'life', ''];
const STATUSES = ['Active', 'Expired', 'Expiring Soon', ''];

export async function runSearchScenario(sessions) {
  console.log('\n━━━ Scenario 4: Search & Filter Stress (20 concurrent users) ━━━');
  const store = new ResultStore('S4 - Search & Filter');

  if (!sessions.length) {
    console.log('  ⚠  No sessions — skipping search test');
    return store;
  }

  async function doSearches(session) {
    const cookie = session.sessionCookie;
    const idx = session.agent.index;
    const times = [];

    // Rotate search/filter combos per agent
    for (let i = 0; i < 4; i++) {
      const term = SEARCH_TERMS[(idx + i) % SEARCH_TERMS.length];
      const type = TYPES[(idx + i) % TYPES.length];
      const status = STATUSES[i % STATUSES.length];

      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (term) params.set('search', term);
      if (type) params.set('type', type);
      if (status) params.set('status', status);

      const { ms, res } = await timedFetch(
        store,
        `GET /api/customers?${params.toString()}`,
        `${BASE_URL}/api/customers?${params.toString()}`,
        { headers: { Cookie: cookie } }
      );
      times.push(ms);
    }

    // Also test pagination with a high page number  
    const { ms: page5ms } = await timedFetch(
      store,
      'GET /api/customers?page=5',
      `${BASE_URL}/api/customers?page=5&limit=50`,
      { headers: { Cookie: cookie } }
    );
    times.push(page5ms);

    console.log(
      `  [S4] Agent ${String(idx).padStart(2)}: searches=[${times.slice(0,4).map(t=>t+'ms').join(', ')}] page5=${page5ms}ms`
    );
  }

  await Promise.all(sessions.map(s => doSearches(s)));
  return store;
}
