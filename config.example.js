window.PERS_CONFIG = {
  version: "0.27.10",
  deploymentId: "CHANGE-TO-A-UNIQUE-ROLLOUT-ID",
  mode: "supabase",
  appName: "Your Favourites",
  ownerDisplayName: "Owner",
  homeRegion: "Your city / region",
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabasePublishableKey: "sb_publishable_YOUR_PROJECT_KEY",
  placesSearchEndpoint: ""
};

window.addEventListener('load', function () {
  if (document.querySelector('script[data-pers-v027j]')) return;
  const script = document.createElement('script');
  script.src = './v027j.js?v=0.27.10';
  script.dataset.persV027j = 'true';
  document.body.appendChild(script);
}, { once: true });
