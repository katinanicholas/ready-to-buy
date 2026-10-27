/**
 * One-time setup and maintenance. Run these from the Apps Script editor
 * (pick the function in the toolbar, then Run).
 */

/**
 * Fills in Katina's known details (from the listing lookbooks and email signature).
 * Never overwrites a value already set. Run once, before setup().
 * WEB_APP_URL still has to be added by hand after you deploy.
 */
function loadKnownProperties() {
  var props = PropertiesService.getScriptProperties();
  var known = {
    NOTIFY_EMAIL: 'realbodden@gmail.com',
    SCHEDULING_URL: 'https://calendly.com/katinabodden/let-s-chat',
    SENDER_NAME: 'Katina Bodden | Epique Realty',
    AGENT_DISPLAY_NAME: 'Katina Bodden',
    AGENT_LICENSED_NAME: 'Katina Bodden',
    LICENSE_NUMBER: 'S-58840',
    BROKERAGE_NAME: 'Epique Realty',
    BROKERAGE_ADDRESS: '520 Pass Rd Ste L, Gulfport, MS 39507',
    BROKERAGE_PHONE: '888.893.3537',
    AGENT_PHONE: '228.346.6781',
    PRIVACY_URL: 'https://katinanicholas.github.io/ready-to-buy/privacy.html',
    TEST_MODE: 'true'
  };
  var set = [];
  Object.keys(known).forEach(function (k) {
    if (!props.getProperty(k)) { props.setProperty(k, known[k]); set.push(k); }
  });
  console.log(set.length ? 'Set: ' + set.join(', ') : 'Nothing to set; all values already present.');
  console.log('Still add by hand: WEB_APP_URL, after you deploy.');
}

/** Creates the Leads sheet (if needed) and installs the hourly + daily triggers. Safe to run again. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.create('Homebuyer Readiness Leads');
    props.setProperty('SHEET_ID', ss.getId());
    console.log('Created sheet: ' + ss.getUrl());
  }
  var cfg = getConfig_();
  getSheet_(cfg);
  installTriggers();
  checkConfiguration();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'processFollowUps' || fn === 'purgeOldRecords') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processFollowUps').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('purgeOldRecords').timeBased().everyDays(1).atHour(3).create();
  console.log('Triggers installed: processFollowUps hourly, purgeOldRecords daily.');
}

/** Logs what is set and what is missing. Never logs secret values. */
function checkConfiguration() {
  var cfg = getConfig_();
  var props = PropertiesService.getScriptProperties().getProperties();
  var lines = [];
  lines.push(cfg.missing.length ? 'MISSING (required): ' + cfg.missing.join(', ') : 'All required properties are set.');
  ['AGENT_LICENSED_NAME', 'LICENSE_NUMBER', 'BROKERAGE_PHONE', 'PRIVACY_URL'].forEach(function (k) {
    if (!props[k]) lines.push('Recommended, not set: ' + k);
  });
  if (cfg.SCHEDULING_URL && !/^https:\/\//.test(cfg.SCHEDULING_URL)) lines.push('SCHEDULING_URL must start with https://');
  if (cfg.WEB_APP_URL && !/\/exec$/.test(cfg.WEB_APP_URL)) lines.push('WEB_APP_URL should end in /exec (the deployed URL, not /dev).');
  lines.push('TEST_MODE: ' + cfg.testMode + (cfg.testMode ? ' (buyer emails go to NOTIFY_EMAIL)' : ''));
  lines.push('Turnstile: ' + (props.TURNSTILE_SECRET ? 'on' : 'off'));
  lines.push('Calendar booking check: ' + (cfg.CALENDAR_ID ? 'on (' + cfg.CALENDAR_ID + ')' : 'off (manual column only)'));
  lines.push('Mail quota left today: ' + MailApp.getRemainingDailyQuota());
  console.log(lines.join('\n'));
  return lines;
}

/**
 * Sends one sample of every email to NOTIFY_EMAIL so you can review them in Gmail:
 * three report pathways, the lead notification, and the follow-up.
 */
function sendTestEmails() {
  var cfg = getConfig_();
  if (!cfg.NOTIFY_EMAIL) throw new Error('Set NOTIFY_EMAIL first.');
  var brand = brandFromConfig_(cfg);
  var samples = {
    ready: { q1: ['A'], q2: 'B', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'B', q8: 'C', q9: 'D' },
    facts: { q1: ['B', 'C'], q2: 'C', q3: 'C', q4: 'D', q5: 'B', q6: 'C', q7: 'C', q8: 'D', q9: 'C' },
    prepare: { q1: ['A'], q2: 'D', q3: 'D', q4: 'C', q5: 'C', q6: 'D', q7: 'D', q8: 'B', q9: 'E' }
  };
  var fakeUnsub = (cfg.WEB_APP_URL || 'https://example.invalid/exec') + '?action=unsubscribe&t=00000000-0000-0000-0000-000000000000';
  Object.keys(samples).forEach(function (k) {
    var report = Assessment.buildReport(samples[k]);
    var e = renderReportEmail(report, { firstName: 'Sample', schedulingUrl: cfg.SCHEDULING_URL, unsubscribeUrl: k === 'ready' ? fakeUnsub : '', brand: brand });
    MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, subject: '[SAMPLE] ' + e.subject, htmlBody: e.html, body: e.text, name: cfg.SENDER_NAME });
  });
  var r = Assessment.buildReport(samples.facts);
  var n = renderNotificationEmail({
    firstName: 'Sample', email: cfg.NOTIFY_EMAIL, marketingConsent: true, submissionId: 'sample-0000000000000000',
    timestamp: new Date().toString(), responses: Assessment.answersForDisplay(samples.facts)
  }, r, { brand: brand });
  MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, subject: '[SAMPLE] ' + n.subject, htmlBody: n.html, body: n.text, name: 'Readiness Assessment' });
  var f = renderFollowUpEmail({ firstName: 'Sample', schedulingUrl: cfg.SCHEDULING_URL, unsubscribeUrl: fakeUnsub, brand: brand });
  MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, subject: '[SAMPLE] ' + f.subject, htmlBody: f.html, body: f.text, name: cfg.SENDER_NAME });
  console.log('Sent 5 sample emails to ' + cfg.NOTIFY_EMAIL);
}

/** For end-to-end testing: makes every scheduled follow-up due now, then runs the sender. */
function testRunFollowUpsNow() {
  var cfg = getConfig_();
  var sh = getSheet_(cfg);
  var last = sh.getLastRow();
  if (last < 2) { console.log('No rows.'); return; }
  var c = colMap_(sh);
  var rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  rows.forEach(function (r, i) {
    if (r[c['Follow-up Status']] === 'scheduled') sh.getRange(i + 2, c['Follow-up Due'] + 1).setValue(new Date(Date.now() - 60000));
  });
  processFollowUps();
  console.log('Follow-ups processed. Check the Follow-up Status column.');
}
