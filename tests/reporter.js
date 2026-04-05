// tests/reporter.js
// Generates a rich Markdown + JSON performance report from all scenario results

import fs from 'fs';
import path from 'path';
import { percentile } from './config.js';

function badge(value, goodThreshold, warnThreshold, unit = 'ms') {
  const val = typeof value === 'number' ? value : 0;
  let emoji;
  if (val <= goodThreshold) emoji = '🟢';
  else if (val <= warnThreshold) emoji = '🟡';
  else emoji = '🔴';
  return `${emoji} ${val}${unit}`;
}

function formatTable(headers, rows) {
  const lines = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    lines.push('| ' + row.join(' | ') + ' |');
  }
  return lines.join('\n');
}

export function generateReport(summaries, outputDir = './tests/results') {
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(outputDir, `report-${timestamp}.json`);
  const mdPath = path.join(outputDir, `report-${timestamp}.md`);

  // Save raw JSON
  fs.writeFileSync(jsonPath, JSON.stringify(summaries, null, 2));

  // ── Build Markdown report ─────────────────────────────────────────────────────
  const lines = [];

  lines.push('# 🏋️ Insurance CRM — Load Test Report');
  lines.push(`\n**Generated:** ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  lines.push(`**Target:** https://insurance-crm-in.vercel.app`);
  lines.push(`**Concurrent Users:** 20`);
  lines.push(`**Stack:** Next.js 15 · NextAuth v4 · MongoDB Atlas · Gemini 2.5 Flash Lite`);
  lines.push('');

  // Executive summary
  lines.push('---');
  lines.push('## 📊 Executive Summary');
  lines.push('');

  const execRows = summaries.map(s => [
    s.scenario,
    s.totalRequests,
    s.successRate,
    badge(s.p50, 300, 1000),
    badge(s.p95, 1000, 2500),
    badge(s.p99, 2000, 5000),
    s.errorCount > 0 ? `⚠️ ${s.errorCount}` : '✅ 0',
  ]);

  lines.push(formatTable(
    ['Scenario', 'Requests', 'Success Rate', 'p50', 'p95', 'p99', 'Errors'],
    execRows
  ));
  lines.push('');

  // Per-scenario detail
  for (const s of summaries) {
    lines.push('---');
    lines.push(`## ${s.scenario}`);
    lines.push('');
    lines.push(`- **Total Requests:** ${s.totalRequests}`);
    lines.push(`- **Success Rate:** ${s.successRate}`);
    lines.push(`- **Wall Time:** ${(s.wallTimeMs / 1000).toFixed(1)}s`);
    lines.push(`- **p50:** ${s.p50}ms | **p95:** ${s.p95}ms | **p99:** ${s.p99}ms`);
    lines.push('');

    if (Object.keys(s.breakdown).length) {
      lines.push('### Breakdown by Endpoint');
      lines.push('');
      const bRows = Object.entries(s.breakdown).map(([label, b]) => [
        `\`${label}\``,
        b.count,
        badge(b.p50, 300, 1000),
        badge(b.p95, 1000, 2500),
        badge(b.p99, 2000, 5000),
        `${b.min}ms`,
        `${b.max}ms`,
      ]);
      lines.push(formatTable(
        ['Endpoint', 'Count', 'p50', 'p95', 'p99', 'Min', 'Max'],
        bRows
      ));
      lines.push('');
    }

    if (s.errors.length) {
      lines.push('### ⚠️ Error Samples (first 10)');
      lines.push('');
      lines.push('```');
      for (const e of s.errors.slice(0, 10)) {
        lines.push(`[${e.statusCode}] ${e.label}: ${e.detail}`);
      }
      lines.push('```');
      lines.push('');
    }
  }

  // ── Findings & Recommendations ────────────────────────────────────────────────
  lines.push('---');
  lines.push('## 🔍 Key Findings & Bottleneck Analysis');
  lines.push('');

  // Check for slow p95 values
  const slowEndpoints = [];
  for (const s of summaries) {
    for (const [label, b] of Object.entries(s.breakdown)) {
      if (b.p95 > 2000) slowEndpoints.push({ scenario: s.scenario, label, p95: b.p95 });
    }
  }

  if (slowEndpoints.length) {
    lines.push('### 🔴 Slow Endpoints (p95 > 2s)');
    lines.push('');
    for (const e of slowEndpoints) {
      lines.push(`- **${e.label}** (${e.scenario}): p95 = ${e.p95}ms`);
    }
    lines.push('');
  } else {
    lines.push('### 🟢 All endpoints responded within 2s at p95');
    lines.push('');
  }

  lines.push('### Gemini Rate Limit Analysis');
  lines.push('');
  lines.push('The PDF queue (`pdfQueue.ts`) is **client-side only** — it serializes uploads');
  lines.push('per browser tab but does NOT coordinate across multiple concurrent users.');
  lines.push('');
  lines.push('**Impact:** With 20 users each uploading 3 PDFs simultaneously:');
  lines.push('- The server receives up to 60 concurrent `/api/extract-policy` requests');
  lines.push('- Gemini Free Tier: **15 RPM hard limit** → 429 errors expected for 45+ requests');
  lines.push('- Each 429 triggers a 10s client-side retry (`RETRY_DELAY_MS = 10000`)');
  lines.push('- **No server-side queue** means all 60 requests hit Gemini simultaneously');
  lines.push('');
  lines.push('**Recommendation:** Move the queue to a server-side Redis/BullMQ worker or');
  lines.push('use Gemini\'s built-in streaming with a shared per-minute counter in MongoDB.');
  lines.push('');

  lines.push('---');
  lines.push('## 📈 Scaling Recommendations');
  lines.push('');
  lines.push('### For 100 Users');
  lines.push('');
  lines.push('| Component | Current State | Recommended Change |');
  lines.push('|-----------|--------------|-------------------|');
  lines.push('| Gemini Queue | Client-side (per-tab) | Server-side BullMQ + Redis |');
  lines.push('| MongoDB | Atlas Free (512MB) | M10+ cluster ($57/mo) |');
  lines.push('| Vercel | Hobby (10s timeout) | Pro plan (60s timeout) |');
  lines.push('| Auth Sessions | JWT stateless | No change needed |');
  lines.push('| PDF Processing | Sync serverless fn | Async worker + webhooks |');
  lines.push('');
  lines.push('### MongoDB Index Recommendations');
  lines.push('');
  lines.push('```javascript');
  lines.push('// Existing (should be verified):');
  lines.push('db.customers.createIndex({ agentId: 1 })');
  lines.push('db.customers.createIndex({ agentId: 1, type: 1 })');
  lines.push('db.customers.createIndex({ agentId: 1, endDate: 1 })');
  lines.push('');
  lines.push('// Recommended additions for search performance:');
  lines.push('db.customers.createIndex({ agentId: 1, customerName: 1 })');
  lines.push('db.customers.createIndex({ agentId: 1, createdAt: -1 })  // for sort');
  lines.push('// Replace regex search with text index for scale:');
  lines.push('db.customers.createIndex(');
  lines.push('  { customerName: "text", phone: "text", policyNumber: "text" },');
  lines.push('  { weights: { policyNumber: 10, customerName: 5, phone: 1 } }');
  lines.push(')');
  lines.push('```');
  lines.push('');
  lines.push('### Architecture Improvements');
  lines.push('');
  lines.push('1. **Server-Side PDF Queue** — Use `pg-boss` or `BullMQ` to process extractions');
  lines.push('   asynchronously. Return a `jobId` immediately and poll for results. This');
  lines.push('   eliminates the 10s serverless timeout risk.');
  lines.push('');
  lines.push('2. **Gemini Quota Pooling** — Rotate between multiple free Gemini API keys');
  lines.push('   (one per GCP project) to multiply the effective RPM limit.');
  lines.push('');
  lines.push('3. **Connection Pooling** — Upgrade from `connectDB()` per-request to a');
  lines.push('   proper singleton with `maxPoolSize` set. Mongoose already does this if');
  lines.push('   `MONGODB_URI` is cached — verify `global._mongooseCache` is being used.');
  lines.push('');
  lines.push('4. **Rate Limit Headers** — Add `Retry-After` headers to 429 responses so');
  lines.push('   the client queue can back off intelligently instead of using a fixed 10s.');
  lines.push('');
  lines.push('5. **Vercel Edge Caching** — Cache dashboard stats for 30s with');
  lines.push('   `res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")`');
  lines.push('   to reduce MongoDB load under concurrent dashboard views.');

  lines.push('');
  lines.push('---');
  lines.push(`*Report generated by Insurance CRM Load Test Suite • ${new Date().toISOString()}*`);

  fs.writeFileSync(mdPath, lines.join('\n'));

  console.log(`\n  📄 JSON report: ${jsonPath}`);
  console.log(`  📝 Markdown report: ${mdPath}`);

  return { jsonPath, mdPath };
}
