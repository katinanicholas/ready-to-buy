/**
 * Email templates. Pure functions (no Apps Script services), so they can be
 * previewed and tested in Node: npm run preview:emails
 *
 * Table layout + inline styles for Gmail, Outlook, and Apple Mail.
 * Every user-supplied value goes through esc_().
 */

var EMAIL_COLORS = { teal: '#1A4744', brass: '#C4964A', brassDeep: '#8F6A2C', ink: '#1D2726', muted: '#4F5E5B', line: '#D5DDDA', tint: '#F1F6F5' };
var SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
var SANS = "'DM Sans', Arial, Helvetica, sans-serif";

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl_(u) {
  return /^https:\/\/[^\s"<>]+$/i.test(String(u || '')) ? String(u) : '';
}

function button_(label, url) {
  var href = safeUrl_(url);
  if (!href) return '<p style="margin:0;font-family:' + SANS + ';color:#ffffff;">' + esc_(label) + ': scheduling link not configured.</p>';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td bgcolor="' + EMAIL_COLORS.brass + '" style="border-radius:6px;">' +
    '<a href="' + esc_(href) + '" target="_blank" style="display:inline-block;padding:14px 24px;font-family:' + SANS +
    ';font-size:16px;font-weight:bold;color:' + EMAIL_COLORS.ink + ';text-decoration:none;border-radius:6px;">' + esc_(label) + '</a>' +
    '</td></tr></table>';
}

function senderBlock_(brand) {
  var lines = [];
  lines.push('<strong>' + esc_(brand.agentName) + ', ' + esc_(brand.agentTitle) + '</strong> | <strong>' + esc_(brand.brokerage) + '</strong>');
  var lic = [];
  if (brand.licensedName) lic.push(esc_(brand.licensedName));
  lic.push('Licensed in ' + esc_(brand.licenseState || 'Mississippi') + (brand.licenseNumber ? ', License ' + esc_(brand.licenseNumber) : ''));
  lines.push(lic.join('. '));
  if (brand.agentPhone || brand.agentEmail) {
    lines.push([brand.agentPhone ? 'Cell ' + esc_(brand.agentPhone) : '', brand.agentEmail ? esc_(brand.agentEmail) : ''].filter(Boolean).join(' | '));
  }
  var bro = esc_(brand.brokerage);
  if (brand.brokerageAddress) bro += ', ' + esc_(brand.brokerageAddress);
  if (brand.brokeragePhone) bro += ', ' + esc_(brand.brokeragePhone);
  lines.push(bro);
  lines.push('Equal Housing Opportunity.');
  return lines.join('<br>');
}

function senderText_(brand) {
  return [
    brand.agentName + ', ' + brand.agentTitle + ' | ' + brand.brokerage,
    (brand.licensedName ? brand.licensedName + '. ' : '') + 'Licensed in ' + (brand.licenseState || 'Mississippi') + (brand.licenseNumber ? ', License ' + brand.licenseNumber : ''),
    [brand.agentPhone ? 'Cell ' + brand.agentPhone : '', brand.agentEmail || ''].filter(Boolean).join(' | '),
    brand.brokerage + (brand.brokerageAddress ? ', ' + brand.brokerageAddress : '') + (brand.brokeragePhone ? ', ' + brand.brokeragePhone : ''),
    'Equal Housing Opportunity.'
  ].join('\n');
}

function shell_(preheader, inner, brand, footerExtra) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>' + esc_(preheader) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#EEF2F1;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F1;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;">' +
    '<tr><td bgcolor="' + EMAIL_COLORS.teal + '" style="padding:16px 28px;font-family:' + SANS + ';font-size:15px;font-weight:bold;color:#ffffff;">' +
    esc_(brand.agentName) + ' <span style="color:' + EMAIL_COLORS.brass + ';">|</span> ' + esc_(brand.brokerage) + '</td></tr>' +
    inner +
    '<tr><td style="padding:20px 28px 28px;border-top:1px solid ' + EMAIL_COLORS.line + ';font-family:' + SANS +
    ';font-size:12px;line-height:1.6;color:' + EMAIL_COLORS.muted + ';">' + senderBlock_(brand) +
    (footerExtra ? '<br><br>' + footerExtra : '') + '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function p_(html, extra) {
  return '<p style="margin:0 0 16px;font-family:' + SANS + ';font-size:16px;line-height:1.6;color:' + EMAIL_COLORS.ink + ';' + (extra || '') + '">' + html + '</p>';
}

// --------------------------------------------------------------------------- buyer report

/**
 * ctx: { firstName, schedulingUrl, unsubscribeUrl ('' if no consent), brand }
 * Returns { subject, html, text }
 */
function renderReportEmail(report, ctx) {
  var b = ctx.brand;
  var subject = 'Your Homebuyer Readiness Report: ' + report.pathwayName;

  var steps = report.steps.map(function (s, i) {
    return '<tr><td valign="top" style="width:36px;padding:0 0 18px;font-family:' + SERIF + ';font-size:28px;line-height:1;color:' + EMAIL_COLORS.brassDeep + ';">' + (i + 1) + '</td>' +
      '<td valign="top" style="padding:0 0 18px;font-family:' + SANS + ';font-size:16px;line-height:1.55;color:' + EMAIL_COLORS.ink + ';">' +
      '<strong>' + esc_(s.title) + '</strong><br>' + esc_(s.body) + '</td></tr>';
  }).join('');

  var notes = report.notes.map(function (n) {
    return p_(esc_(n), 'border-left:2px solid ' + EMAIL_COLORS.brass + ';padding-left:12px;font-size:15px;');
  }).join('');

  var inner =
    '<tr><td style="padding:32px 28px 8px;">' +
    p_('Hi ' + esc_(ctx.firstName) + ',') +
    p_('Thanks for taking the Homebuyer Readiness Assessment. Here are your results.') +
    '<p style="margin:24px 0 4px;font-family:' + SANS + ';font-size:14px;color:' + EMAIL_COLORS.muted + ';">Your readiness pathway</p>' +
    '<h1 style="margin:0 0 16px;padding-bottom:16px;border-bottom:2px solid ' + EMAIL_COLORS.brass + ';font-family:' + SERIF +
    ';font-size:40px;line-height:1.05;font-weight:normal;color:' + EMAIL_COLORS.teal + ';">' + esc_(report.pathwayName) + '</h1>' +
    '<p style="margin:0 0 20px;font-family:' + SERIF + ';font-size:21px;line-height:1.4;color:' + EMAIL_COLORS.ink + ';">' + esc_(report.explanation) + '</p>' +
    notes +
    '<h2 style="margin:28px 0 14px;font-family:' + SANS + ';font-size:17px;color:' + EMAIL_COLORS.ink + ';">Your recommended next steps</h2>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + steps + '</table>' +
    '<h2 style="margin:12px 0 8px;font-family:' + SANS + ';font-size:17px;color:' + EMAIL_COLORS.ink + ';">Your top concern</h2>' +
    p_('<em style="font-family:' + SERIF + ';font-size:19px;">' + esc_(report.concern.answer) + '</em><br>' + esc_(report.concern.guidance)) +
    '<h2 style="margin:12px 0 8px;font-family:' + SANS + ';font-size:17px;color:' + EMAIL_COLORS.ink + ';">What will help most</h2>' +
    p_('<em style="font-family:' + SERIF + ';font-size:19px;">' + esc_(report.help.answer) + '</em><br>' + esc_(report.help.guidance)) +
    '</td></tr>' +
    '<tr><td bgcolor="' + EMAIL_COLORS.teal + '" style="padding:28px;">' +
    '<p style="margin:0 0 18px;font-family:' + SERIF + ';font-size:22px;line-height:1.35;color:#ffffff;">' + esc_(report.cta.support) + '</p>' +
    button_(report.cta.label, ctx.schedulingUrl) +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px 8px;">' +
    p_('Talk soon,<br>' + esc_(b.agentName)) +
    '<p style="margin:0 0 8px;font-family:' + SANS + ';font-size:12px;line-height:1.5;color:' + EMAIL_COLORS.muted + ';">' + esc_(report.disclaimer) + '</p>' +
    '</td></tr>';

  var footer = 'You received this email because you requested your Homebuyer Readiness Report.';
  if (ctx.unsubscribeUrl && safeUrl_(ctx.unsubscribeUrl)) {
    footer += ' You also asked for occasional tips and follow-up. <a href="' + esc_(ctx.unsubscribeUrl) + '" style="color:' + EMAIL_COLORS.teal + ';">Unsubscribe</a>.';
  } else {
    footer += ' You will not receive marketing emails from this assessment.';
  }
  if (b.privacyUrl && safeUrl_(b.privacyUrl)) footer += ' <a href="' + esc_(b.privacyUrl) + '" style="color:' + EMAIL_COLORS.teal + ';">Privacy notice</a>.';

  var html = shell_('Your pathway: ' + report.pathwayName + '. Your next steps are inside.', inner, b, footer);

  var text = [
    'Hi ' + ctx.firstName + ',',
    '',
    'Thanks for taking the Homebuyer Readiness Assessment. Here are your results.',
    '',
    'YOUR READINESS PATHWAY: ' + report.pathwayName,
    report.explanation,
    ''
  ].concat(report.notes.length ? report.notes.concat(['']) : [])
    .concat(['Your recommended next steps'])
    .concat(report.steps.map(function (s, i) { return (i + 1) + '. ' + s.title + '\n   ' + s.body; }))
    .concat([
      '',
      'Your top concern: ' + report.concern.answer,
      report.concern.guidance,
      '',
      'What will help most: ' + report.help.answer,
      report.help.guidance,
      '',
      report.cta.support,
      report.cta.label + ': ' + (safeUrl_(ctx.schedulingUrl) || '[scheduling link not configured]'),
      '',
      'Talk soon,',
      b.agentName,
      '',
      report.disclaimer,
      '',
      senderText_(b),
      '',
      ctx.unsubscribeUrl ? 'Unsubscribe from follow-up: ' + ctx.unsubscribeUrl : 'You will not receive marketing emails from this assessment.'
    ]).join('\n');

  return { subject: subject, html: html, text: text };
}

// --------------------------------------------------------------------------- Katina's notification

/**
 * lead: { firstName, email, marketingConsent, submissionId, timestamp, responses:[{question, answer}] }
 */
function renderNotificationEmail(lead, report, ctx) {
  var subject = 'New readiness lead: ' + lead.firstName + ' | ' + report.pathwayName + ' | ' + report.summary.timeline;
  function row(k, v) {
    return '<tr><td valign="top" style="padding:6px 12px 6px 0;font-family:' + SANS + ';font-size:14px;color:' + EMAIL_COLORS.muted + ';white-space:nowrap;">' + esc_(k) +
      '</td><td style="padding:6px 0;font-family:' + SANS + ';font-size:14px;color:' + EMAIL_COLORS.ink + ';">' + v + '</td></tr>';
  }
  var responses = lead.responses.map(function (r, i) {
    return '<tr><td style="padding:8px 0;border-top:1px solid ' + EMAIL_COLORS.line + ';font-family:' + SANS + ';font-size:14px;line-height:1.5;color:' + EMAIL_COLORS.ink + ';">' +
      '<span style="color:' + EMAIL_COLORS.muted + ';">Q' + (i + 1) + '. ' + esc_(r.question) + '</span><br>' + esc_(r.answer) + '</td></tr>';
  }).join('');

  var html = '<!doctype html><html><body style="margin:0;padding:20px;background:#ffffff;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">' +
    '<tr><td style="font-family:' + SERIF + ';font-size:28px;color:' + EMAIL_COLORS.teal + ';padding-bottom:12px;">' + esc_(lead.firstName) + ': ' + esc_(report.pathwayName) + '</td></tr>' +
    '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
    row('Name', esc_(lead.firstName)) +
    row('Email', '<a href="mailto:' + esc_(lead.email) + '">' + esc_(lead.email) + '</a>') +
    row('Pathway', '<strong>' + esc_(report.pathwayName) + '</strong>') +
    row('Timeline', esc_(report.summary.timeline)) +
    row('Top concern', esc_(report.summary.concern)) +
    row('Requested help', esc_(report.summary.help)) +
    row('Marketing consent', lead.marketingConsent ? 'Yes. Follow-up scheduled.' : 'No. Report only, no follow-up.') +
    row('Submitted', esc_(lead.timestamp)) +
    row('Why this pathway', esc_(report.decision.rule + ': ' + report.decision.reasons.join(' '))) +
    row('Submission ID', '<span style="font-size:12px;">' + esc_(lead.submissionId) + '</span>') +
    '</table></td></tr>' +
    '<tr><td style="padding-top:18px;font-family:' + SANS + ';font-size:16px;font-weight:bold;color:' + EMAIL_COLORS.ink + ';">Responses</td></tr>' +
    '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + responses + '</table></td></tr>' +
    '<tr><td style="padding-top:16px;font-family:' + SANS + ';font-size:12px;color:' + EMAIL_COLORS.muted + ';">Reply to this email to write to the lead directly. ' +
    'The buyer already received their report automatically. If they book a call, tick "Booked (manual)" in the Leads sheet to stop the follow-up.</td></tr>' +
    '</table></body></html>';

  var text = [
    'New readiness lead',
    'Name: ' + lead.firstName,
    'Email: ' + lead.email,
    'Pathway: ' + report.pathwayName,
    'Timeline: ' + report.summary.timeline,
    'Top concern: ' + report.summary.concern,
    'Requested help: ' + report.summary.help,
    'Marketing consent: ' + (lead.marketingConsent ? 'Yes' : 'No'),
    'Submitted: ' + lead.timestamp,
    'Why this pathway: ' + report.decision.rule + ': ' + report.decision.reasons.join(' '),
    'Submission ID: ' + lead.submissionId,
    '',
    'Responses'
  ].concat(lead.responses.map(function (r, i) { return 'Q' + (i + 1) + '. ' + r.question + '\n    ' + r.answer; })).join('\n');

  return { subject: subject, html: html, text: text };
}

// --------------------------------------------------------------------------- 48-hour follow-up (consent only)

/** ctx: { firstName, schedulingUrl, unsubscribeUrl (required), brand } */
function renderFollowUpEmail(ctx) {
  if (!safeUrl_(ctx.unsubscribeUrl)) throw new Error('Follow-up requires an unsubscribe link.');
  var b = ctx.brand;
  var cta = Assessment.CTA;
  var subject = 'Questions about your Homebuyer Readiness Report?';
  var body1 = 'I hope your Homebuyer Readiness Report gave you some clarity about your next steps. If you have questions or would like to explore your options, I\'d be happy to help.';
  var inner = '<tr><td style="padding:32px 28px 8px;">' +
    p_('Hi ' + esc_(ctx.firstName) + ',') +
    p_(esc_(body1)) +
    '</td></tr>' +
    '<tr><td bgcolor="' + EMAIL_COLORS.teal + '" style="padding:28px;">' +
    '<p style="margin:0 0 18px;font-family:' + SERIF + ';font-size:22px;line-height:1.35;color:#ffffff;">' + esc_(cta.support) + '</p>' +
    button_(cta.label, ctx.schedulingUrl) + '</td></tr>' +
    '<tr><td style="padding:24px 28px 8px;">' + p_(esc_(b.agentName)) + '</td></tr>';
  var footer = 'You received this one-time follow-up because you opted in when you requested your Homebuyer Readiness Report. ' +
    '<a href="' + esc_(ctx.unsubscribeUrl) + '" style="color:' + EMAIL_COLORS.teal + ';">Unsubscribe</a>.';
  var html = shell_('A quick check-in about your readiness report.', inner, b, footer);
  var text = [
    'Hi ' + ctx.firstName + ',', '', body1, '', cta.support,
    cta.label + ': ' + (safeUrl_(ctx.schedulingUrl) || '[scheduling link not configured]'), '',
    b.agentName, '', senderText_(b), '',
    'You received this because you opted in. Unsubscribe: ' + ctx.unsubscribeUrl
  ].join('\n');
  return { subject: subject, html: html, text: text };
}
