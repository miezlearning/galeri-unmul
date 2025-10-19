// Force PDDIKTI fetches to go through Vercel Serverless proxy, even when hosted on GitHub Pages
// This overrides the globally-defined searchMahasiswa used elsewhere.
(function(){
  const API_BASE = 'https://api-pddikti.ridwaanhall.com/search/mhs/';
  const PROXY_BASE = 'https://galeri-unmul.vercel.app/api/pddikti-proxy?url=';

  // 1) Wrap window.fetch to transparently reroute PDDIKTI calls via Vercel proxy
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
      if (typeof url === 'string' && url.startsWith('https://api-pddikti.ridwaanhall.com/')) {
        const proxied = PROXY_BASE + encodeURIComponent(url);
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

  async function viaAllOrigins(url, signal){
    const raw = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    const res = await fetch(raw, { headers: { 'Accept': 'application/json' }, signal });
    if (!res.ok) throw new Error('AllOrigins fetch failed: ' + res.status);
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      try { return JSON.parse(String(text)); } catch { throw new Error('Invalid proxy response'); }
    }
  }

  // 2) Also expose a replacement for searchMahasiswa used elsewhere, to be safe
  window.searchMahasiswa = async function(query, signal){
    const url = API_BASE + encodeURIComponent(query);
    try {
      const data = await viaVercelProxy(url, signal);
      const list = normalize(data);
      console.debug('PDDIKTI via vercel proxy', { query, count: list.length });
      return list;
    } catch (e) {
      console.warn('Vercel proxy failed, trying AllOrigins fallback:', e?.message || e);
      try {
        const data = await viaAllOrigins(url, signal);
        const list = normalize(data);
        console.debug('PDDIKTI via AllOrigins', { query, count: list.length });
        return list;
      } catch (e2) {
        console.error('AllOrigins fallback failed:', e2?.message || e2);
        return [];
      }
    }
  }
})();
