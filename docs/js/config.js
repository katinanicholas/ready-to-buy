/*
 * Public site configuration. Everything in this file is visible to anyone.
 * NEVER put API keys, passwords, or secrets here.
 *
 * Leave ENDPOINT_URL empty to run in TEST MODE: the quiz works, results show on screen,
 * and the page clearly says no email was sent.
 */
window.APP_CONFIG = {
  // Apps Script web app URL ending in /exec (see README, "Deploy the backend").
  ENDPOINT_URL: 'https://script.google.com/macros/s/AKfycbwkg6Fc5swCXF2qQPBJb7hDlv4S3Mez0OTXbAyTmIv9EUVu6s1nOixb1zobu93pNAYzCQ/exec',

  // Katina's existing scheduling page (same link as the listing lookbooks).
  // Also set as SCHEDULING_URL in the backend Script Properties (used in emails).
  SCHEDULING_URL: 'https://calendly.com/katinabodden/let-s-chat',

  // Optional Cloudflare Turnstile bot check. Public site key only.
  // If set, TURNSTILE_SECRET must be set in the backend Script Properties.
  TURNSTILE_SITE_KEY: '',

  // After this many failed sends, offer to show results on screen anyway.
  RESULTS_ON_SCREEN_AFTER_FAILURES: 2,

  PRIVACY_URL: 'privacy.html',

  // Footer and disclosure details. Confirm each before launch.
  AGENT_DISPLAY_NAME: 'Katina Bodden',
  AGENT_TITLE: 'Realtor',
  AGENT_LICENSED_NAME: 'Katina Bodden',
  LICENSE_STATE: 'Mississippi',
  LICENSE_NUMBER: 'S-58840',
  BROKERAGE_NAME: 'Epique Realty',
  BROKERAGE_ADDRESS: '520 Pass Rd Ste L, Gulfport, MS 39507',
  BROKERAGE_PHONE: '888.893.3537',
  AGENT_PHONE: '228.346.6781',
  AGENT_EMAIL: 'realbodden@gmail.com'
};
