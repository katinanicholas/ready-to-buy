const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { root, loadBackend } = require('../scripts/load');

const answers = { q1: ['A', 'C'], q2: 'B', q3: 'C', q4: 'B', q5: 'B', q6: 'C', q7: 'B', q8: 'D', q9: 'C' };
const brand = { agentName: 'Katina Bodden', agentTitle: 'Realtor', licensedName: 'Licensed Name', licenseState: 'Mississippi',
  licenseNumber: 'S-58840', brokerage: 'Epique Realty', brokerageAddress: '123 Main St', brokeragePhone: '888.893.3537', privacyUrl: '' };
const SCHED = 'https://calendly.example/katina';

// ------------------------------------------------------------ in-memory Apps Script mocks

function makeServices(props) {
  const sent = [];
  const cache = new Map();
  const rows = [];
  let headers = null;
  const sheet = {
    appendRow(r) { if (!headers) { headers = r; } else rows.push(r.slice()); },
    setFrozenRows() {},
    getLastRow() { return headers ? rows.length + 1 : 0; },
    getLastColumn() { return headers ? headers.length : 0; },
    getRange(r, c, nr, nc) {
      return {
        getValues() {
          const all = [headers].concat(rows);
          return all.slice(r - 1, r - 1 + (nr || 1)).map((row) => row.slice(c - 1, c - 1 + (nc || 1)));
        },
        setValue(v) { if (r === 1) headers[c - 1] = v; else rows[r - 2][c - 1] = v; }
      };
    },
    deleteRow(r) { rows.splice(r - 2, 1); }
  };
  let failBuyerMail = false;
  const services = {
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({}, props), getProperty: (k) => props[k], setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail(o) { if (failBuyerMail && o.name !== 'Readiness Assessment') throw new Error('mail down'); sent.push(o); }
    },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => (headers ? sheet : null), insertSheet: () => sheet }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, _tz, p) => (p === 'yyyyMMddHH' ? d.toISOString().slice(0, 13) : d.toISOString()),
      computeDigest: (_a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    Session: { getScriptTimeZone: () => 'America/Chicago' },
    ContentService: { createTextOutput: (s) => ({ setMimeType() { return s; } }), MimeType: { JSON: 'json' } },
    CalendarApp: { getDefaultCalendar: () => ({ getEvents: (_s, _e, o) => (o.search === 'booked@example.com' ? [{}] : []) }) },
    UrlFetchApp: { fetch: () => ({ getContentText: () => '{"success":true}' }) }
  };
  return { services, sent, rows, getHeaders: () => headers, failMail: (v) => { failBuyerMail = v; } };
}

const fullProps = () => ({
  NOTIFY_EMAIL: 'realbodden@gmail.com', SCHEDULING_URL: SCHED, WEB_APP_URL: 'https://script.google.com/macros/s/X/exec',
  SHEET_ID: 'sheet', BROKERAGE_ADDRESS: '123 Main St', LICENSE_NUMBER: 'S-58840'
});

function payload(over) {
  return Object.assign({
    submissionId: crypto.randomUUID(), firstName: 'Jordan', email: 'jordan@example.com', answers,
    marketingConsent: false, consentText: 'Optional: tips', company: '', elapsedMs: 60000
  }, over || {});
}
const post = (g, body) => g.handleSubmission_({ postData: { contents: JSON.stringify(body) } });

// ------------------------------------------------------------ sync

test('Assessment.gs is an exact copy of docs/js/assessment.js', () => {
  const src = fs.readFileSync(path.join(root, 'docs/js/assessment.js'), 'utf8');
  const gs = fs.readFileSync(path.join(root, 'backend/apps-script/Assessment.gs'), 'utf8');
  assert.equal(gs.split('\n').slice(1).join('\n'), src, 'Run npm run sync');
});

test('no secrets or provider keys in the public site', () => {
  const dir = path.join(root, 'docs');
  const files = ['index.html', 'privacy.html', 'js/app.js', 'js/config.js', 'js/assessment.js'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/(api[_-]?key|secret\s*[:=]\s*['"][^'"]+|re_[A-Za-z0-9]{20,}|SG\.[A-Za-z0-9_-]{20,})/i.test(t.replace(/TURNSTILE_SECRET/g, '')), f);
  }
});

// ------------------------------------------------------------ validation

test('validatePayload_ accepts a good payload and trims the name', () => {
  const g = loadBackend();
  const v = g.validatePayload_(payload({ firstName: '  Mary  Ann ' }));
  assert.equal(v.ok, true);
  assert.equal(v.clean.firstName, 'Mary Ann');
});

test('validatePayload_ flags bots and bad input', () => {
  const g = loadBackend();
  assert.equal(g.validatePayload_(payload({ company: 'spam inc' })).bot, true);
  assert.equal(g.validatePayload_(payload({ elapsedMs: 2000 })).bot, true);
  assert.equal(g.validatePayload_(payload({ email: 'not-an-email' })).code, 'invalid');
  assert.equal(g.validatePayload_(payload({ firstName: '<script>' })).code, 'invalid');
  assert.equal(g.validatePayload_(payload({ marketingConsent: 'yes' })).code, 'invalid');
  assert.equal(g.validatePayload_(payload({ submissionId: 'x' })).code, 'invalid');
  assert.equal(g.validatePayload_(payload({ answers: { q1: ['A'] } })).code, 'invalid');
  assert.equal(g.validatePayload_(payload({ firstName: 'José' })).ok, true);
  assert.equal(g.validatePayload_(payload({ firstName: "D'Andre" })).ok, true);
});

// ------------------------------------------------------------ templates

test('report email: pathway, steps, scheduling link, escaping, disclaimer', () => {
  const g = loadBackend();
  for (const [a, name] of [
    [{ q1: ['A'], q2: 'B', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'B', q8: 'C', q9: 'D' }, 'Ready to Explore'],
    [answers, 'Get the Facts First'],
    [Object.assign({}, answers, { q4: 'C' }), 'Prepare with Purpose']
  ]) {
    const r = g.Assessment.buildReport(a);
    const e = g.renderReportEmail(r, { firstName: 'Jo<b>', schedulingUrl: SCHED, unsubscribeUrl: '', brand });
    assert.equal(r.pathwayName, name);
    assert.ok(e.subject.endsWith(name));
    assert.ok(e.html.includes('Jo&lt;b&gt;') && !e.html.includes('Jo<b>'));
    assert.ok(e.html.includes(SCHED) && e.text.includes(SCHED));
    assert.ok(e.html.includes('Schedule a Strategy Call with Katina Bodden'));
    r.steps.forEach((s) => assert.ok(e.text.includes(s.title)));
    assert.ok(e.html.includes('does not determine mortgage eligibility'));
    assert.ok(e.html.includes('Epique Realty') && e.html.includes('Equal Housing Opportunity'));
    assert.ok(!/unsubscribe/i.test(e.html.replace(/You will not receive marketing/, '')), 'no unsubscribe link without consent');
  }
});

test('report email includes unsubscribe only with consent', () => {
  const g = loadBackend();
  const r = g.Assessment.buildReport(answers);
  const e = g.renderReportEmail(r, { firstName: 'Jo', schedulingUrl: SCHED, unsubscribeUrl: 'https://script.google.com/x/exec?action=unsubscribe&t=abc', brand });
  assert.ok(/Unsubscribe/.test(e.html));
});

test('missing scheduling URL is stated, not faked', () => {
  const g = loadBackend();
  const e = g.renderReportEmail(g.Assessment.buildReport(answers), { firstName: 'Jo', schedulingUrl: '', unsubscribeUrl: '', brand });
  assert.ok(e.html.includes('scheduling link not configured'));
  assert.ok(!/href="https?:\/\/[^"]*calendly/i.test(e.html));
});

test('follow-up email uses approved draft, CTA, sender ID, and requires unsubscribe', () => {
  const g = loadBackend();
  assert.throws(() => g.renderFollowUpEmail({ firstName: 'Jo', schedulingUrl: SCHED, unsubscribeUrl: '', brand }));
  const f = g.renderFollowUpEmail({ firstName: 'Jo', schedulingUrl: SCHED, unsubscribeUrl: 'https://script.google.com/x/exec?action=unsubscribe&t=1', brand });
  assert.ok(f.text.includes("I hope your Homebuyer Readiness Report gave you some clarity about your next steps. If you have questions or would like to explore your options, I'd be happy to help."));
  assert.ok(f.text.startsWith('Hi Jo,'));
  assert.ok(f.html.includes(SCHED) && /Unsubscribe/.test(f.html) && f.html.includes('123 Main St'));
});

test('notification email has every required field and all nine responses', () => {
  const g = loadBackend();
  const r = g.Assessment.buildReport(answers);
  const n = g.renderNotificationEmail({ firstName: 'Jordan', email: 'jordan@example.com', marketingConsent: true, submissionId: 'abc',
    timestamp: '2026-10-26 09:00 CDT', responses: g.Assessment.answersForDisplay(answers) }, r, { brand });
  for (const s of ['Jordan', 'jordan@example.com', r.pathwayName, r.summary.timeline, r.summary.concern, r.summary.help, '2026-10-26 09:00 CDT', 'Marketing consent']) {
    assert.ok(n.text.includes(s), s);
  }
  for (let i = 1; i <= 9; i++) assert.ok(n.text.includes('Q' + i + '. '));
});

// ------------------------------------------------------------ end to end (mocked)

test('not configured: no email sent, honest response', () => {
  const m = makeServices({});
  const g = loadBackend(m.services);
  assert.deepEqual(JSON.parse(JSON.stringify(post(g, payload()))), { ok: false, code: 'not_configured' });
  assert.equal(m.sent.length, 0);
});

test('success: buyer report + Katina notification, row recorded, no follow-up without consent', () => {
  const m = makeServices(fullProps());
  const g = loadBackend(m.services);
  const res = post(g, payload());
  assert.equal(res.ok, true);
  assert.equal(m.sent.length, 2);
  assert.equal(m.sent[0].to, 'jordan@example.com');
  assert.match(m.sent[0].subject, /Get the Facts First/);
  assert.equal(m.sent[1].to, 'realbodden@gmail.com');
  assert.equal(m.sent[1].replyTo, 'jordan@example.com');
  assert.equal(m.rows.length, 1);
  const h = m.getHeaders();
  assert.equal(m.rows[0][h.indexOf('Follow-up Status')], 'no consent');
  assert.equal(m.rows[0][h.indexOf('Unsub Token')], '');
});

test('duplicate submission ID or quick re-submit does not send twice', () => {
  const m = makeServices(fullProps());
  const g = loadBackend(m.services);
  const p = payload();
  post(g, p);
  assert.equal(post(g, p).status, 'duplicate');
  assert.equal(post(g, payload()).status, 'duplicate'); // same email within 10 minutes
  assert.equal(m.sent.length, 2);
});

test('bots get a quiet ok but nothing is sent or stored', () => {
  const m = makeServices(fullProps());
  const g = loadBackend(m.services);
  assert.equal(post(g, payload({ company: 'x' })).ok, true);
  assert.equal(post(g, payload({ elapsedMs: 100 })).ok, true);
  assert.equal(m.sent.length, 0);
  assert.equal(m.rows.length, 0);
});

test('buyer email failure is reported as failure, never as sent', () => {
  const m = makeServices(fullProps());
  m.failMail(true);
  const g = loadBackend(m.services);
  const res = post(g, payload());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'server');
});

test('TEST_MODE redirects buyer email to Katina', () => {
  const m = makeServices(Object.assign(fullProps(), { TEST_MODE: 'true' }));
  const g = loadBackend(m.services);
  post(g, payload());
  assert.equal(m.sent[0].to, 'realbodden@gmail.com');
  assert.match(m.sent[0].subject, /^\[TEST for jordan@example.com\]/);
});

test('rate limit stops sending', () => {
  const m = makeServices(Object.assign(fullProps(), { MAX_SUBMISSIONS_PER_HOUR: '1' }));
  const g = loadBackend(m.services);
  post(g, payload());
  const res = post(g, payload({ email: 'other@example.com' }));
  assert.equal(res.code, 'rate_limited');
});

test('consented follow-up: sent after due, suppressed when booked or unsubscribed', () => {
  const m = makeServices(Object.assign(fullProps(), { CALENDAR_ID: 'primary' }));
  const g = loadBackend(m.services);
  post(g, payload({ marketingConsent: true, email: 'yes@example.com' }));
  post(g, payload({ marketingConsent: true, email: 'booked@example.com' }));
  post(g, payload({ marketingConsent: true, email: 'manual@example.com' }));
  post(g, payload({ marketingConsent: true, email: 'gone@example.com' }));
  post(g, payload({ marketingConsent: false, email: 'no@example.com' }));
  const h = m.getHeaders();
  const col = (n) => h.indexOf(n);
  assert.match(m.sent.find((s) => s.to === 'yes@example.com').htmlBody, /Unsubscribe/);
  m.rows.forEach((r) => { if (r[col('Follow-up Due')]) r[col('Follow-up Due')] = new Date(Date.now() - 1000); });
  m.rows[2][col('Booked (manual)')] = true;
  // unsubscribe via the real handler
  const htmlOut = { createHtmlOutput: (s) => ({ setTitle: () => s }) };
  g.HtmlService = htmlOut;
  const page = g.doGet({ parameter: { action: 'unsubscribe', t: m.rows[3][col('Unsub Token')] } });
  assert.match(page, /unsubscribed/i);

  const before = m.sent.length;
  g.processFollowUps();
  const followUps = m.sent.slice(before);
  assert.deepEqual(followUps.map((s) => s.to), ['yes@example.com']);
  assert.match(followUps[0].body, /I'd be happy to help/);
  const statuses = m.rows.map((r) => r[col('Follow-up Status')]);
  assert.match(statuses[0], /^sent /);
  assert.equal(statuses[1], 'suppressed: on calendar');
  assert.equal(statuses[2], 'suppressed: booked');
  assert.equal(statuses[3], 'unsubscribed');
  assert.equal(statuses[4], 'no consent');

  g.processFollowUps(); // runs again: nothing new
  assert.equal(m.sent.length, before + 1);
});
