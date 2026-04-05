// tests/s1-auth.js
// Scenario 1: 20 concurrent login flows
// Tests: NextAuth credentials flow, JWT generation, MongoDB read performance
//
// NextAuth credentials flow (redirect: 'manual' approach):
//   POST /api/auth/callback/credentials → 302 with Set-Cookie on the redirect response itself
//   The session token is in the Set-Cookie of THAT 302, not the final destination.
//   We capture it there, then verify with GET /api/auth/session.

import { BASE_URL, TEST_AGENTS, ResultStore, timedFetch, now, elapsed, sleep } from './config.js';

/** Extract all Set-Cookie values from a Headers object */
function extractCookies(headers) {
  // Node fetch gives a single combined set-cookie string OR allows getSetCookie()
  const cookies = {};
  // Try the newer getSetCookie() (Node 18+)
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') ?? ''];

  for (const cookieStr of raw) {
    if (!cookieStr) continue;
    const parts = cookieStr.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export async function runAuthScenario() {
  console.log('\n━━━ Scenario 1: Authentication (20 concurrent logins) ━━━');
  const store = new ResultStore('S1 - Authentication');

  async function getCsrfToken() {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf`);
      const data = await res.json();
      return { token: data.csrfToken, rawCookie: res.headers.get('set-cookie') ?? '' };
    } catch {
      return { token: null, rawCookie: '' };
    }
  }

  async function loginAgent(agent) {
    const t = now();

    // Step 1: Get CSRF token (also captures the csrf cookie that must be sent back)
    const { token: csrfToken, rawCookie: csrfCookieHeader } = await getCsrfToken();
    if (!csrfToken) {
      store.record('csrf-fetch', elapsed(t), 0, false, 'Could not get CSRF token');
      return { agent, sessionCookie: null, ok: false };
    }

    // Extract the next-auth.csrf-token cookie name (may be __Host- prefixed on HTTPS)
    const csrfCookieName = csrfCookieHeader.split('=')[0] || 'next-auth.csrf-token';
    const csrfCookieValue = csrfCookieHeader.split(';')[0] || '';

    // Step 2: POST credentials — NextAuth sends 302 + Set-Cookie here
    const body = new URLSearchParams({
      csrfToken,
      email: agent.email,
      password: agent.password,
      callbackUrl: `${BASE_URL}/dashboard`,
      json: 'true',
    });

    let callbackRes;
    const t2 = now();
    try {
      callbackRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Send the csrf cookie back, as NextAuth validates it
          Cookie: csrfCookieValue,
        },
        body: body.toString(),
        redirect: 'manual', // Don't follow — we want the 302 cookies
      });
    } catch (err) {
      store.record('POST /api/auth/callback/credentials', elapsed(t2), 0, false, err.message);
      return { agent, sessionCookie: null, ok: false };
    }

    const callbackMs = elapsed(t2);
    const callbackStatus = callbackRes.status;

    // Collect all cookies from the 302 response
    const setCookies = extractCookies(callbackRes.headers);

    // NextAuth session cookie is either:
    //   next-auth.session-token  (HTTP / dev)
    //   __Secure-next-auth.session-token  (HTTPS / production)
    const sessionToken =
      setCookies['__Secure-next-auth.session-token'] ||
      setCookies['next-auth.session-token'];

    const cookieName = setCookies['__Secure-next-auth.session-token']
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const sessionCookie = sessionToken ? `${cookieName}=${sessionToken}` : null;

    store.record(
      'POST /api/auth/callback/credentials',
      callbackMs,
      callbackStatus,
      callbackStatus === 302 || callbackStatus === 200,
      sessionCookie ? 'session token captured' : 'no session token in response'
    );

    // Step 3: Verify session is valid
    if (sessionCookie) {
      const { ms: sessionMs, body: sessionBody, res: sessionRes } = await timedFetch(
        store,
        'GET /api/auth/session',
        `${BASE_URL}/api/auth/session`,
        { headers: { Cookie: sessionCookie } }
      );
      const hasUser = !!sessionBody?.user;
      console.log(
        `  [S1] Agent ${String(agent.index).padStart(2)}: ` +
        `login=${callbackMs}ms(${callbackStatus}) ` +
        `session=${sessionMs}ms(${sessionRes?.status}) ` +
        `user=${hasUser ? sessionBody.user.email : 'MISSING'}`
      );
      return { agent, sessionCookie, ok: hasUser };
    }

    // Step 3b: If no session cookie in 302, the response might be JSON (json:true mode)
    // Try reading if it was a 200 JSON response
    if (callbackStatus === 200) {
      const responseText = await callbackRes.text().catch(() => '');
      const isJson = responseText.startsWith('{');
      if (isJson) {
        // The URL in the JSON points to where the session was set — try fetching session directly
        const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
          headers: { Cookie: csrfCookieValue },
        }).catch(() => null);
        const sessionData = await sessionRes?.json().catch(() => null);
        if (sessionData?.user) {
          // We have a live session via the CSRF cookie — reconstruct the session cookie differently
          // For testing purposes mark this agent as authenticated via CSRF cookie
          const altCookie = csrfCookieValue;
          console.log(
            `  [S1] Agent ${String(agent.index).padStart(2)}: ` +
            `login=${callbackMs}ms(${callbackStatus}) — session via CSRF cookie`
          );
          return { agent, sessionCookie: altCookie, ok: true };
        }
      }
    }

    console.log(
      `  [S1] Agent ${String(agent.index).padStart(2)}: ` +
      `login=${callbackMs}ms(${callbackStatus}) — ✗ no session cookie (keys: ${Object.keys(setCookies).join(',')})`
    );
    return { agent, sessionCookie: null, ok: false };
  }

  // Fire all 20 logins simultaneously
  const loginResults = await Promise.all(TEST_AGENTS.map(agent => loginAgent(agent)));
  const sessions = loginResults.filter(r => r.sessionCookie);
  console.log(`\n  Sessions obtained: ${sessions.length}/20`);

  return { store, sessions };
}
