/**
 * Am I Ready to Buy? Backend (Google Apps Script web app).
 *
 * Runs as Katina's Google account. Secrets and settings live in
 * Project Settings > Script Properties, never in the website.
 *
 * Files in this project:
 *   Code.gs            intake, validation, sending, follow-up, unsubscribe (this file)
 *   EmailTemplates.gs  HTML + text emails
 *   Setup.gs           one-time setup, triggers, config check, test sends
 *   Assessment.gs      GENERATED copy of docs/js/assessment.js (npm run sync). Do not edit.
 */

var REQUIRED_PROPS = ['NOTIFY_EMAIL', 'SCHEDULING_URL', 'WEB_APP_URL', 'SHEET_ID', 'BROKERAGE_ADDRESS'];

var DEFAULTS = {
  SENDER_NAME: 'Katina | Epique Realty',
  AGENT_DISPLAY_NAME: 'Katina',
  AGENT_TITLE: 'Realtor',
  AGENT_LICENSED_NAME: '',
  LICENSE_STATE: 'Mississippi',
  LICENSE_NUMBER: '',
  BROKERAGE_NAME: 'Epique Realty',
  BROKERAGE_PHONE: '',
  AGENT_PHONE: '',
  PRIVACY_URL: '',
  TEST_MODE: 'false',
  FOLLOW_UP_HOURS: '48',
  RETENTION_DAYS: '365',
  MAX_SUBMISSIONS_PER_HOUR: '40',
  MIN_ELAPSED_MS: '15000',
  CALENDAR_ID: '',
  TURNSTILE_SECRET: ''
};

var SHEET_NAME = 'Leads';
var HEADERS = [
  'Timestamp', 'Submission ID', 'First Name', 'Email', 'Pathway', 'Timeline', 'Top Concern',
  'Requested Help', 'Answers', 'Marketing Consent', 'Consent Text', 'Follow-up Due',
  'Follow-up Status', 'Booked (manual)', 'Unsubscribed', 'Unsub Token', 'Notify Status'
];

// --------------------------------------------------------------------------- config

function getConfig_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var cfg = {};
  Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = props[k] !== undefined && props[k] !== '' ? props[k] : DEFAULTS[k]; });
  REQUIRED_PROPS.forEach(function (k) { cfg[k] = props[k] || ''; });
  cfg.missing = REQUIRED_PROPS.filter(function (k) { return !cfg[k]; });
  cfg.testMode = String(cfg.TEST_MODE).toLowerCase() === 'true';
  return cfg;
}

function brandFromConfig_(cfg) {
  return {
    agentName: cfg.AGENT_DISPLAY_NAME,
    agentTitle: cfg.AGENT_TITLE,
    licensedName: cfg.AGENT_LICENSED_NAME,
    licenseState: cfg.LICENSE_STATE,
    licenseNumber: cfg.LICENSE_NUMBER,
    brokerage: cfg.BROKERAGE_NAME,
    brokerageAddress: cfg.BROKERAGE_ADDRESS,
    brokeragePhone: cfg.BROKERAGE_PHONE,
    agentPhone: cfg.AGENT_PHONE,
    agentEmail: cfg.NOTIFY_EMAIL,
    privacyUrl: cfg.PRIVACY_URL
  };
}

// --------------------------------------------------------------------------- http

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    return json_(handleSubmission_(e));
  } catch (err) {
    console.error('doPost failed: ' + (err && err.stack || err));
    return json_({ ok: false, code: 'server' });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'unsubscribe') return unsubscribePage_(p.t);
  if (p.action === 'health') {
    var cfg = getConfig_();
    // Reveals only whether setup is complete, never values.
    return json_({ ok: true, configured: cfg.missing.length === 0, testMode: cfg.testMode });
  }
  return HtmlService.createHtmlOutput('<p>Nothing to see here.</p>');
}

// --------------------------------------------------------------------------- validation (pure)

var NAME_RE_ = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]{0,49}$/u;
var EMAIL_RE_ = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
var ID_RE_ = /^[A-Za-z0-9\-]{16,64}$/;

/** Pure validation. Returns { ok, code, message, clean, bot }. */
function validatePayload_(body, opts) {
  opts = opts || {};
  var minElapsed = Number(opts.minElapsedMs || 15000);
  if (!body || typeof body !== 'object') return { ok: false, code: 'invalid', message: 'Missing data.' };

  // Bot signals. Treated as silent drops by the caller.
  if (body.company) return { ok: false, bot: true, code: 'honeypot' };
  if (typeof body.elapsedMs !== 'number' || body.elapsedMs < minElapsed) return { ok: false, bot: true, code: 'too_fast' };

  if (typeof body.submissionId !== 'string' || !ID_RE_.test(body.submissionId)) {
    return { ok: false, code: 'invalid', message: 'Reload the page and try again.' };
  }
  var name = String(body.firstName || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE_.test(name)) return { ok: false, code: 'invalid', message: 'Check your first name and try again.' };
  var email = String(body.email || '').trim();
  if (email.length > 254 || !EMAIL_RE_.test(email)) return { ok: false, code: 'invalid', message: 'Check your email address and try again.' };
  if (typeof body.marketingConsent !== 'boolean') return { ok: false, code: 'invalid', message: 'Reload the page and try again.' };

  var v = Assessment.validateAnswers(body.answers);
  if (!v.valid) return { ok: false, code: 'invalid', message: 'Some answers are missing. Go back and finish the questions.' };

  return {
    ok: true,
    clean: {
      submissionId: body.submissionId,
      firstName: name,
      email: email,
      emailKey: email.toLowerCase(),
      answers: v.answers,
      marketingConsent: body.marketingConsent === true,
      consentText: String(body.consentText || '').slice(0, 300)
    }
  };
}

// --------------------------------------------------------------------------- intake

function handleSubmission_(e) {
  var cfg = getConfig_();
  if (cfg.missing.length) {
    console.warn('Not configured. Missing: ' + cfg.missing.join(', '));
    return { ok: false, code: 'not_configured' };
  }

  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 10000) return { ok: false, code: 'invalid', message: 'Reload the page and try again.' };
  var body;
  try { body = JSON.parse(raw); } catch (x) { return { ok: false, code: 'invalid', message: 'Reload the page and try again.' }; }

  var v = validatePayload_(body, { minElapsedMs: cfg.MIN_ELAPSED_MS });
  if (v.bot) {
    console.info('Dropped likely bot submission: ' + v.code);
    return { ok: true, status: 'accepted' }; // do not tip off bots; nothing is sent
  }
  if (!v.ok) return { ok: false, code: v.code, message: v.message };
  var lead = v.clean;

  if (cfg.TURNSTILE_SECRET && !verifyTurnstile_(cfg.TURNSTILE_SECRET, body.turnstileToken)) {
    return { ok: false, code: 'verification_failed' };
  }

  var cache = CacheService.getScriptCache();
  var subKey = 'sub:' + lead.submissionId;
  if (cache.get(subKey)) return { ok: true, status: 'duplicate' };          // same click, resent
  var emailKey = 'em:' + sha256_(lead.emailKey);
  if (cache.get(emailKey)) return { ok: true, status: 'duplicate' };        // same person, minutes apart

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'server' };
  try {
    if (cache.get(subKey)) return { ok: true, status: 'duplicate' };

    var hourKey = 'rate:' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
    var count = Number(cache.get(hourKey) || 0);
    if (count >= Number(cfg.MAX_SUBMISSIONS_PER_HOUR)) return { ok: false, code: 'rate_limited' };

    if (MailApp.getRemainingDailyQuota() < 2) return { ok: false, code: 'quota' };

    var report = Assessment.buildReport(lead.answers);
    var brand = brandFromConfig_(cfg);
    var unsubToken = Utilities.getUuid();
    var unsubscribeUrl = lead.marketingConsent ? cfg.WEB_APP_URL + '?action=unsubscribe&t=' + unsubToken : '';

    // 1. The buyer's report. If this fails, the buyer is told it failed.
    var email = renderReportEmail(report, {
      firstName: lead.firstName, schedulingUrl: cfg.SCHEDULING_URL, unsubscribeUrl: unsubscribeUrl, brand: brand
    });
    sendMail_(cfg, lead.email, email, { replyTo: cfg.NOTIFY_EMAIL });

    // 2. Katina's notification. Failure is logged, the buyer still got the report.
    var now = new Date();
    var notifyStatus = 'sent';
    try {
      var note = renderNotificationEmail({
        firstName: lead.firstName, email: lead.email, marketingConsent: lead.marketingConsent,
        submissionId: lead.submissionId,
        timestamp: Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm z"),
        responses: Assessment.answersForDisplay(lead.answers)
      }, report, { brand: brand });
      MailApp.sendEmail({
        to: cfg.NOTIFY_EMAIL, subject: note.subject, htmlBody: note.html, body: note.text,
        name: 'Readiness Assessment', replyTo: lead.email
      });
    } catch (nErr) {
      notifyStatus = 'failed: ' + String(nErr).slice(0, 120);
      console.error('Notification failed: ' + nErr);
    }

    // 3. Record. Follow-up only scheduled with consent.
    var due = lead.marketingConsent ? new Date(now.getTime() + Number(cfg.FOLLOW_UP_HOURS) * 3600 * 1000) : '';
    try {
      getSheet_(cfg).appendRow([
        now, lead.submissionId, lead.firstName, lead.email, report.pathwayName, report.summary.timeline,
        report.summary.concern, report.summary.help, Assessment.encodeAnswers(lead.answers),
        lead.marketingConsent, lead.marketingConsent ? lead.consentText : '', due,
        lead.marketingConsent ? 'scheduled' : 'no consent', false, false,
        lead.marketingConsent ? unsubToken : '', notifyStatus
      ]);
    } catch (sErr) {
      console.error('Sheet write failed: ' + sErr);
    }

    cache.put(hourKey, String(count + 1), 3600);
    cache.put(subKey, '1', 21600);
    cache.put(emailKey, '1', 600);
    return { ok: true, status: 'sent' };
  } catch (err) {
    console.error('Submission failed: ' + (err && err.stack || err));
    return { ok: false, code: 'server' };
  } finally {
    lock.releaseLock();
  }
}

function sendMail_(cfg, to, email, extra) {
  var recipient = to;
  var subject = email.subject;
  if (cfg.testMode) {           // TEST_MODE: every buyer email goes to Katina instead
    recipient = cfg.NOTIFY_EMAIL;
    subject = '[TEST for ' + to + '] ' + subject;
  }
  MailApp.sendEmail({
    to: recipient, subject: subject, htmlBody: email.html, body: email.text,
    name: cfg.SENDER_NAME, replyTo: (extra && extra.replyTo) || cfg.NOTIFY_EMAIL
  });
}

function verifyTurnstile_(secret, token) {
  if (!token) return false;
  try {
    var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post', payload: { secret: secret, response: String(token) }, muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText()).success === true;
  } catch (e) {
    console.error('Turnstile check failed: ' + e);
    return false;
  }
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

// --------------------------------------------------------------------------- sheet

function getSheet_(cfg) {
  var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function colMap_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var m = {};
  head.forEach(function (h, i) { m[h] = i; });
  return m;
}

// --------------------------------------------------------------------------- follow-up (time trigger)

/** Runs hourly. Sends the one consented follow-up ~48 hours after the report. */
function processFollowUps() {
  var cfg = getConfig_();
  if (cfg.missing.length) return;
  var sh = getSheet_(cfg);
  var last = sh.getLastRow();
  if (last < 2) return;
  var c = colMap_(sh);
  var rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var now = new Date();
  var brand = brandFromConfig_(cfg);

  rows.forEach(function (r, i) {
    var rowNum = i + 2;
    if (r[c['Follow-up Status']] !== 'scheduled') return;
    if (r[c['Marketing Consent']] !== true) { setStatus_(sh, rowNum, c, 'no consent'); return; }
    var due = r[c['Follow-up Due']];
    if (!isDate_(due) || due > now) return;
    if (r[c['Unsubscribed']] === true) { setStatus_(sh, rowNum, c, 'unsubscribed'); return; }
    if (r[c['Booked (manual)']] === true) { setStatus_(sh, rowNum, c, 'suppressed: booked'); return; }
    if (hasBooked_(cfg, r[c['Email']], r[c['Timestamp']])) { setStatus_(sh, rowNum, c, 'suppressed: on calendar'); return; }
    if (MailApp.getRemainingDailyQuota() < 1) return; // try next hour

    try {
      var email = renderFollowUpEmail({
        firstName: r[c['First Name']],
        schedulingUrl: cfg.SCHEDULING_URL,
        unsubscribeUrl: cfg.WEB_APP_URL + '?action=unsubscribe&t=' + r[c['Unsub Token']],
        brand: brand
      });
      sendMail_(cfg, r[c['Email']], email);
      setStatus_(sh, rowNum, c, 'sent ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
    } catch (err) {
      console.error('Follow-up failed for row ' + rowNum + ': ' + err);
      setStatus_(sh, rowNum, c, 'failed');
    }
  });
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function setStatus_(sh, rowNum, c, status) {
  sh.getRange(rowNum, c['Follow-up Status'] + 1).setValue(status);
}

/**
 * Optional booking check. If CALENDAR_ID is set (for example "primary"), looks for a
 * calendar event mentioning the lead's email, created by a booking tool that syncs to
 * Google Calendar. If unset or the check errors, returns false and the manual
 * "Booked (manual)" column is the only suppression.
 */
function hasBooked_(cfg, email, since) {
  if (!cfg.CALENDAR_ID || !email) return false;
  try {
    var cal = cfg.CALENDAR_ID === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(cfg.CALENDAR_ID);
    if (!cal) return false;
    var start = isDate_(since) ? since : new Date(Date.now() - 3 * 864e5);
    var end = new Date(Date.now() + 120 * 864e5);
    return cal.getEvents(start, end, { search: String(email) }).length > 0;
  } catch (e) {
    console.warn('Calendar check skipped: ' + e);
    return false;
  }
}

// --------------------------------------------------------------------------- unsubscribe

function unsubscribePage_(token) {
  var ok = false;
  if (token && /^[a-f0-9\-]{36}$/i.test(token)) {
    var cfg = getConfig_();
    var sh = getSheet_(cfg);
    var last = sh.getLastRow();
    if (last >= 2) {
      var c = colMap_(sh);
      var data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
      var email = '';
      data.forEach(function (r) { if (r[c['Unsub Token']] === token) email = String(r[c['Email']]).toLowerCase(); });
      if (email) {
        data.forEach(function (r, i) {
          if (String(r[c['Email']]).toLowerCase() === email) {
            sh.getRange(i + 2, c['Unsubscribed'] + 1).setValue(true);
            if (r[c['Follow-up Status']] === 'scheduled') sh.getRange(i + 2, c['Follow-up Status'] + 1).setValue('unsubscribed');
          }
        });
        ok = true;
      }
    }
  }
  var msg = ok
    ? "You're unsubscribed. You won't get any more follow-up emails from this assessment."
    : 'This unsubscribe link is not valid or has expired. Reply to any email from Katina and ask to be removed.';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1D2726;line-height:1.6">' +
    '<h1 style="font-family:Georgia,serif;font-weight:normal;color:#1A4744">' + (ok ? 'Unsubscribed' : 'Link not valid') + '</h1>' +
    '<p>' + msg + '</p></div>'
  ).setTitle('Unsubscribe');
}

// --------------------------------------------------------------------------- retention (time trigger)

/** Runs daily. Deletes rows older than RETENTION_DAYS. */
function purgeOldRecords() {
  var cfg = getConfig_();
  if (cfg.missing.length) return;
  var days = Number(cfg.RETENTION_DAYS);
  if (!(days > 0)) return;
  var sh = getSheet_(cfg);
  var last = sh.getLastRow();
  if (last < 2) return;
  var cutoff = new Date(Date.now() - days * 864e5);
  var stamps = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = stamps.length - 1; i >= 0; i--) {
    if (isDate_(stamps[i][0]) && stamps[i][0] < cutoff) sh.deleteRow(i + 2);
  }
}
