(function () {
  'use strict';

  const cfg = window.PERS_CONFIG || {};
  const deploymentId = cfg.deploymentId || location.pathname;
  const storageKey = `pers-v026-brand:${deploymentId}`;
  let manifestObjectUrl = '';

  function cleanName(value) {
    const v = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
    return v || 'Pers Favourites';
  }

  function shortName(name) {
    const n = cleanName(name);
    return n.length <= 30 ? n : `${n.slice(0, 29).trim()}…`;
  }

  function readCached() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
      const legacy = localStorage.getItem(`pers-v025-brand:${deploymentId}`);
      if (legacy) { const parsed = JSON.parse(legacy); localStorage.setItem(storageKey, legacy); return parsed; }
      return null;
    } catch {
      return null;
    }
  }

  function writeCached(appName, homeRegion) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({appName, homeRegion: String(homeRegion || '')}));
    } catch {}
  }

  function updateManifest(appName) {
    const link = document.getElementById('appManifest');
    if (!link) return;

    const baseUrl = new URL('./', location.href);
    const manifest = {
      id: baseUrl.pathname,
      name: appName,
      short_name: shortName(appName),
      description: 'A curated places collection with personal ratings, photos and map filtering.',
      start_url: baseUrl.href,
      scope: baseUrl.href,
      display: 'standalone',
      background_color: '#fff8ef',
      theme_color: '#285c4d',
      icons: [
        {src: new URL('icons/icon-192.png', baseUrl).href, sizes: '192x192', type: 'image/png'},
        {src: new URL('icons/icon-512.png', baseUrl).href, sizes: '512x512', type: 'image/png'}
      ]
    };

    const blob = new Blob([JSON.stringify(manifest)], {type: 'application/manifest+json'});
    const nextUrl = URL.createObjectURL(blob);
    link.href = nextUrl;
    if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
    manifestObjectUrl = nextUrl;
  }

  function apply(appName, homeRegion) {
    const name = cleanName(appName || cfg.appName);
    document.title = name;

    const appleTitle = document.getElementById('appleAppTitle');
    if (appleTitle) appleTitle.setAttribute('content', name);

    const titleEl = document.getElementById('appTitle');
    if (titleEl) titleEl.textContent = name;

    const regionEl = document.getElementById('homeRegionLabel');
    if (regionEl && homeRegion) regionEl.textContent = homeRegion;

    updateManifest(name);
    writeCached(name, homeRegion);
    return name;
  }

  const cached = readCached();
  window.PERS_BRANDING = {apply, readCached, storageKey};
  apply(cached?.appName || cfg.appName || 'Pers Favourites', cached?.homeRegion || cfg.homeRegion || '');
})();
