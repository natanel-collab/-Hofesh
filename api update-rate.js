// Vercel Cron Job - runs daily to update USD/ILS rate in Supabase
// Schedule: every day at 08:00 Israel time

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Security: only allow Vercel cron calls
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  // Fetch from Bank of Israel API
  let rate = null;
  const apis = [
    { url: 'https://api.exchangerate-api.com/v4/latest/USD', parse: d => d?.rates?.ILS },
    { url: 'https://open.er-api.com/v6/latest/USD', parse: d => d?.rates?.ILS },
    { url: 'https://api.frankfurter.app/latest?from=USD&to=ILS', parse: d => d?.rates?.ILS },
  ];

  for (const { url, parse } of apis) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      const v = parse(d);
      if (v > 1 && v < 8) { rate = parseFloat(v.toFixed(4)); break; }
    } catch(e) {}
  }

  if (!rate) {
    return new Response(JSON.stringify({ error: 'All APIs failed' }), { status: 500 });
  }

  // Update Supabase
  const res = await fetch(`${SUPA_URL}/rest/v1/usd_rate?id=eq.1`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify({ rate, updated_at: new Date().toISOString() }),
  });

  return new Response(JSON.stringify({ 
    success: res.ok, 
    rate, 
    updated: new Date().toISOString() 
  }), { status: res.ok ? 200 : 500 });
}
