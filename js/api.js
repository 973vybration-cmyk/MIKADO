const NHL_API = 'https://api-web.nhle.com/v1';
const WORKER = 'https://nhl-proxy.973vybration.workers.dev';

// Cache mémoire API
const apiCache = new Map();

async function fetchJSON(url) {
  const urls = [
    `${WORKER}?url=${encodeURIComponent(url)}`,
    url
  ];

  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Connexion impossible: ${lastErr?.message}`);
}

async function cachedFetchJSON(url) {
  if (apiCache.has(url)) return apiCache.get(url);
  const data = await fetchJSON(url);
  apiCache.set(url, data);
  return data;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmt(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-CA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}
