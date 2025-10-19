// Force PDDIKTI fetches to go through Vercel Serverless proxy, even when hosted on GitHub Pages
// This overrides the globally-defined searchMahasiswa used elsewhere.
(function(){
  const API_BASE = 'https://api-pddikti.ridwaanhall.com/search/mhs/';
  const VERCEL_HOST = 'https://galeri-unmul.vercel.app';
  const PROXY_BASE = VERCEL_HOST + '/api?url=';

  // 1) Wrap window.fetch to transparently reroute PDDIKTI calls via Vercel proxy
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
      const url = new URL(raw, window.location.origin);
      // If code tries to call relative /api (old or new), rewrite to absolute Vercel domain
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const absolute = VERCEL_HOST + url.pathname + (url.search || '');
        return originalFetch(absolute, init);
      }
      // Backward-compat: If code tries to call relative /api/pddikti-proxy, rewrite to absolute Vercel proxy (new base)
      if (url.pathname.startsWith('/api/pddikti-proxy')) {
        const target = url.searchParams.get('url') || '';
        const proxied = PROXY_BASE + encodeURIComponent(target);
        return originalFetch(proxied, init);
      }
      // If code tries to call PDDIKTI API directly, rewrite to proxy
      if (url.href.startsWith('https://api-pddikti.ridwaanhall.com/')) {
        const proxied = PROXY_BASE + encodeURIComponent(url.href);
        return originalFetch(proxied, init);
      }
      // If any code tries to route via AllOrigins, rewrite it to our Vercel proxy instead
      if (url.href.startsWith('https://api.allorigins.win/raw')) {
        const target = url.searchParams.get('url') || '';
        const proxied = PROXY_BASE + encodeURIComponent(target);
        return originalFetch(proxied, init);
      }
    } catch {}
    return originalFetch(input, init);
  };

  function normalize(data){
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.mahasiswa)) return data.mahasiswa;
    return [];
  }

  async function viaVercelProxy(url, signal){
    const proxied = PROXY_BASE + encodeURIComponent(url);
    const res = await fetch(proxied, { headers: { 'Accept': 'application/json' }, signal });
    if (!res.ok) throw new Error('Proxy fetch failed: ' + res.status);
    return res.json();
  }

  // We intentionally avoid AllOrigins and rely solely on our Vercel proxy for CORS-safe requests.

  // 2) Also expose a replacement for searchMahasiswa used elsewhere, to be safe
  window.searchMahasiswa = async function(query, signal){
    const url = API_BASE + encodeURIComponent(query);
    try {
      const data = await viaVercelProxy(url, signal);
      const list = normalize(data);
      console.debug('PDDIKTI via vercel proxy', { query, count: list.length });
      return list;
    } catch (e) {
      console.error('Vercel proxy failed:', e?.message || e);
      return [];
    }
  }
})();
