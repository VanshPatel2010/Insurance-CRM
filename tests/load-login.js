import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 20,          // 20 virtual users
  duration: '30s',  // run for 30 seconds
}

export default function () {
  const res = http.post(
    'http://localhost:3000/api/auth/callback/credentials',
    JSON.stringify({
      email: `agent${__VU}@test.com`,  // each user has unique email
      password: 'testpassword123',
      redirect: false,
      csrfToken: 'your-csrf-token'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(res, {
    'login successful': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  })

  sleep(1)  // wait 1 second between requests
}