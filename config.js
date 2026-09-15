window.PERS_CONFIG = {
  version: "0.27.10",
  deploymentId: "pers-favourites-per-trial",
  mode: "local",
  appName: "Pers Favourites",
  ownerDisplayName: "Per",
  homeRegion: "Melbourne / Travel",
  supabaseUrl: "",
  supabasePublishableKey: "",
  placesSearchEndpoint: ""
};

// v027j corrective layer is deliberately loaded after the base app has initialised
// so it can replace the older filter/editor event wiring without risking stored data.
window.addEventListener('load', function () {
  if (document.querySelector('script[data-pers-v027j]')) return;
  const script = document.createElement('script');
  script.src = './v027j.js?v=0.27.10';
  script.dataset.persV027j = 'true';
  document.body.appendChild(script);
}, { once: true });
