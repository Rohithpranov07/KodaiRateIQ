// ============================================================
// ⚠️  TEMPORARY DEBUG ROUTE — REMOVE BEFORE GA LAUNCH
//
// GET /api/debug/network-test?secret=<CRON_SECRET>
//
// Tests DNS resolution and HTTP reachability for every OTA
// domain the scraper targets. Identifies which ones fail
// DNS on Railway (ERR_NAME_NOT_RESOLVED) vs. succeed.
//
// Returns per-domain results so broken OTAs can be disabled
// without poisoning the rest of the scraping pipeline.
//
// TO REMOVE: delete src/app/api/debug/ entirely
// ============================================================

import { NextResponse } from 'next/server';
import dns from 'dns/promises';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const OTA_DOMAINS = [
  { name: 'booking.com',             host: 'www.booking.com' },
  { name: 'agoda',                   host: 'www.agoda.com' },
  { name: 'goibibo',                 host: 'www.goibibo.com' },
  { name: 'makemytrip',             host: 'www.makemytrip.com' },
  { name: 'expedia',                 host: 'www.expedia.co.in' },
  { name: 'hotels.com',              host: 'www.hotels.com' },
  { name: 'cleartrip',               host: 'www.cleartrip.com' },
  { name: 'easemytrip',             host: 'hotels.easemytrip.com' },
  { name: 'ixigo',                   host: 'www.ixigo.com' },
  { name: 'yatra',                   host: 'www.yatra.com' },
  { name: 'tripadvisor',            host: 'www.tripadvisor.in' },
  { name: 'trivago',                 host: 'www.trivago.in' },
  // Official hotel booking engines
  { name: 'official:carlton',       host: 'www.thecarlton.in' },
  { name: 'official:tamara',        host: 'www.thetamara.com' },
  { name: 'official:hki',           host: 'www.hotelkodaiinternational.com' },
  { name: 'official:sterling',      host: 'book.sterlingholidays.com' },  // known to fail
  { name: 'official:leposhe',       host: 'www.sparsahotels.com' },
  // Supabase connectivity
  { name: 'supabase',               host: 'aws-1-ap-south-1.pooler.supabase.com' },
] as const;

interface DomainResult {
  status: 'ok' | 'dns_failed' | 'timeout' | 'error';
  addresses?: string[];
  latencyMs?: number;
  error?: string;
}

async function resolveDomain(host: string): Promise<DomainResult> {
  const t0 = Date.now();
  try {
    const addresses = await Promise.race([
      dns.resolve4(host),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS timeout after 5s')), 5000)
      ),
    ]);
    return {
      status:    'ok',
      addresses: addresses.slice(0, 2), // show first 2 IPs max
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    const msg: string = err.message ?? String(err);
    const isDnsFail = msg.includes('ENOTFOUND') || msg.includes('ENODATA') || msg.includes('timeout');
    return {
      status:   isDnsFail ? (msg.includes('timeout') ? 'timeout' : 'dns_failed') : 'error',
      latencyMs: Date.now() - t0,
      error:    msg,
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  const start = Date.now();

  // Resolve all domains in parallel
  const settled = await Promise.allSettled(
    OTA_DOMAINS.map(d => resolveDomain(d.host).then(r => ({ name: d.name, host: d.host, ...r })))
  );

  const results: Record<string, DomainResult & { host: string }> = {};
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      const { name, ...rest } = s.value;
      results[name] = rest;
    }
  }

  const passed  = Object.values(results).filter(r => r.status === 'ok').length;
  const failed  = Object.values(results).filter(r => r.status !== 'ok').length;
  const failing = Object.entries(results)
    .filter(([, r]) => r.status !== 'ok')
    .map(([name, r]) => ({ name, status: r.status, error: r.error }));

  return NextResponse.json({
    // ⚠️ TEMPORARY DEBUG ROUTE
    _warning: 'Temporary debug endpoint — remove before GA launch.',

    summary: {
      total:  OTA_DOMAINS.length,
      passed,
      failed,
    },
    failing,
    results,
    durationMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
}
