export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const { url } = req.query;
  if (!url) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Missing url param' });
  }

  // Safely decode url (handle single/double-encoded cases)
  let target = url;
  try {
    const once = decodeURIComponent(target);
    // If double-encoded, decoding again may change it; try twice safely
    const twice = decodeURIComponent(once);
    target = twice;
  } catch (_) {
    try {
      target = decodeURIComponent(target);
    } catch (_) {
      // keep original
    }
  }

  try {
    const upstream = await fetch(target, { method: 'GET' });
    const buf = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    return res.status(upstream.status).send(buf);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(502).json({ error: 'Upstream fetch failed', detail: String(err?.message || err) });
  }
}
