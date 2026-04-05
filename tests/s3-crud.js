// tests/s3-crud.js
// Scenario 3: Concurrent CRUD operations (10 create, 5 update, 5 delete)
// Tests: MongoDB write isolation, agentId scoping, race conditions

import { BASE_URL, ResultStore, timedFetch, sleep } from './config.js';

// Generate a unique policy number for this test run
const RUN_ID = Math.random().toString(36).slice(2, 8).toUpperCase();

function makePolicyPayload(agentIndex, policyIndex) {
  const types = ['motor', 'medical', 'fire', 'life'];
  const type = types[(agentIndex + policyIndex) % 4];
  const policyNumber = `LOAD-${RUN_ID}-${String(agentIndex).padStart(2, '0')}-${String(policyIndex).padStart(2, '0')}`;

  return {
    type,
    customerName: `Load Test Customer ${agentIndex}-${policyIndex}`,
    phone: `9${String(agentIndex).padStart(3, '0')}${String(policyIndex).padStart(6, '0')}`,
    email: `loadtest${agentIndex}${policyIndex}@example.com`,
    address: `${agentIndex} Test Street, Load City`,
    policyNumber,
    premiumAmount: 5000 + agentIndex * 100,
    sumInsured: 100000,
    startDate: '2025-01-01',
    endDate: '2026-01-01',
    // type-specific extras
    ...(type === 'motor' ? { vehicleReg: `GJ${agentIndex}XX${policyIndex}`, make: 'Maruti', model: 'Swift' } : {}),
    ...(type === 'medical' ? { membersCount: 2, memberNames: ['Member A', 'Member B'] } : {}),
    ...(type === 'fire' ? { propertyType: 'Residential', propertyAddress: 'Test Addr' } : {}),
    ...(type === 'life' ? { nomineeName: `Nominee ${agentIndex}`, nomineeRelation: 'Spouse' } : {}),
  };
}

export async function runCrudScenario(sessions) {
  console.log('\n━━━ Scenario 3: Concurrent CRUD (10 Create + 5 Update + 5 Delete) ━━━');
  const store = new ResultStore('S3 - CRUD Operations');

  if (sessions.length < 20) {
    console.log(`  ⚠  Only ${sessions.length} sessions — will use available sessions`);
  }

  const usedSessions = sessions.slice(0, Math.min(20, sessions.length));

  // ── Phase A: 10 agents create 2 customers each ──────────────────────────────
  const creators = usedSessions.slice(0, 10);
  const createdIds = [];

  console.log('\n  Phase A: Creating customers...');
  const createResults = await Promise.all(
    creators.map(async (session, i) => {
      const localIds = [];
      for (let p = 0; p < 2; p++) {
        const payload = makePolicyPayload(session.agent.index, p);
        const { res, body, ms } = await timedFetch(
          store,
          'POST /api/customers',
          `${BASE_URL}/api/customers`,
          {
            method: 'POST',
            headers: {
              Cookie: session.sessionCookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        const id = body?._id ?? body?.id;
        if (id) localIds.push(id);
        console.log(
          `    [S3-Create] Agent ${String(session.agent.index).padStart(2)}, policy ${p}: ` +
          `${ms}ms — ${res?.status === 201 ? '✓ 201' : `✗ ${res?.status}`}`
        );
      }
      return localIds;
    })
  );
  createdIds.push(...createResults.flat());

  // ── Phase B: 5 agents update existing customers ──────────────────────────────
  console.log('\n  Phase B: Updating customers...');
  const updaters = usedSessions.slice(10, 15);

  await Promise.all(
    updaters.map(async (session, i) => {
      // First fetch the agent's own customer list
      const { body: listBody } = await timedFetch(
        store,
        'GET /api/customers (for update)',
        `${BASE_URL}/api/customers?page=1&limit=10`,
        { headers: { Cookie: session.sessionCookie } }
      );

      const customers = listBody?.customers ?? [];
      if (!customers.length) {
        console.log(`    [S3-Update] Agent ${session.agent.index}: no customers to update`);
        return;
      }

      const target = customers[0];
      const { res, ms } = await timedFetch(
        store,
        'PUT /api/customers/[id]',
        `${BASE_URL}/api/customers/${target._id}`,
        {
          method: 'PUT',
          headers: {
            Cookie: session.sessionCookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...target,
            customerName: `${target.customerName} [Updated]`,
            premiumAmount: (target.premiumAmount || 5000) + 500,
          }),
        }
      );
      console.log(
        `    [S3-Update] Agent ${String(session.agent.index).padStart(2)}: ` +
        `${ms}ms — ${res?.status === 200 ? '✓ 200' : `✗ ${res?.status}`}`
      );
    })
  );

  // ── Phase C: 5 agents delete customers just created ──────────────────────────
  console.log('\n  Phase C: Deleting customers...');
  const deleters = usedSessions.slice(15, 20);

  await Promise.all(
    deleters.map(async (session, i) => {
      const { body: listBody } = await timedFetch(
        store,
        'GET /api/customers (for delete)',
        `${BASE_URL}/api/customers?page=1&limit=5`,
        { headers: { Cookie: session.sessionCookie } }
      );

      const customers = listBody?.customers ?? [];
      if (!customers.length) {
        console.log(`    [S3-Delete] Agent ${session.agent.index}: no customers to delete`);
        return;
      }

      const target = customers[0];
      const { res, ms } = await timedFetch(
        store,
        'DELETE /api/customers/[id]',
        `${BASE_URL}/api/customers/${target._id}`,
        {
          method: 'DELETE',
          headers: { Cookie: session.sessionCookie },
        }
      );
      console.log(
        `    [S3-Delete] Agent ${String(session.agent.index).padStart(2)}: ` +
        `${ms}ms — ${res?.status === 200 ? '✓ 200' : `✗ ${res?.status}`}`
      );
    })
  );

  // ── Cleanup: delete all test customers we created ────────────────────────────
  console.log('\n  Cleanup: removing test customers...');
  await Promise.all(
    createdIds.map(async (id) => {
      // Try from any session that created it (all sessions have their own scope so
      // attempt from the first creator's session — the create returned their own IDs)
      const s = creators[0];
      await timedFetch(
        store,
        'DELETE /api/customers/[id] (cleanup)',
        `${BASE_URL}/api/customers/${id}`,
        { method: 'DELETE', headers: { Cookie: s.sessionCookie } }
      );
    })
  );

  return store;
}
