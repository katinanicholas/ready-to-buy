// Renders every email to email-previews/*.html for review in a browser.
const fs = require('fs');
const path = require('path');
const { root, loadBackend } = require('./load');
const g = loadBackend();
const out = path.join(root, 'email-previews');
fs.mkdirSync(out, { recursive: true });

const brand = {
  agentName: 'Katina Bodden', agentTitle: 'Realtor', licensedName: 'Katina Bodden', licenseState: 'Mississippi',
  licenseNumber: 'S-58840', brokerage: 'Epique Realty', brokerageAddress: '520 Pass Rd Ste L, Gulfport, MS 39507',
  brokeragePhone: '888.893.3537', agentPhone: '228.346.6781', agentEmail: 'realbodden@gmail.com', privacyUrl: 'https://katinanicholas.github.io/ready-to-buy/privacy.html'
};
const sched = 'https://calendly.com/katinabodden/let-s-chat';
const unsub = 'https://script.google.com/macros/s/EXAMPLE/exec?action=unsubscribe&t=00000000-0000-0000-0000-000000000000';
const samples = {
  ready: { q1: ['A'], q2: 'B', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'B', q8: 'C', q9: 'D' },
  facts: { q1: ['B', 'C'], q2: 'C', q3: 'C', q4: 'D', q5: 'B', q6: 'C', q7: 'C', q8: 'D', q9: 'C' },
  prepare: { q1: ['A'], q2: 'D', q3: 'D', q4: 'C', q5: 'C', q6: 'D', q7: 'D', q8: 'B', q9: 'E' }
};
for (const [k, a] of Object.entries(samples)) {
  const r = g.Assessment.buildReport(a);
  const e = g.renderReportEmail(r, { firstName: 'Jordan', schedulingUrl: sched, unsubscribeUrl: k === 'ready' ? unsub : '', brand });
  fs.writeFileSync(path.join(out, `report-${k}.html`), e.html);
  fs.writeFileSync(path.join(out, `report-${k}.txt`), e.text);
}
const r = g.Assessment.buildReport(samples.facts);
const n = g.renderNotificationEmail({ firstName: 'Jordan', email: 'jordan@example.com', marketingConsent: true,
  submissionId: 'preview-0000000000000000', timestamp: '2026-10-26 09:15 CDT', responses: g.Assessment.answersForDisplay(samples.facts) }, r, { brand });
fs.writeFileSync(path.join(out, 'notification.html'), n.html);
const f = g.renderFollowUpEmail({ firstName: 'Jordan', schedulingUrl: sched, unsubscribeUrl: unsub, brand });
fs.writeFileSync(path.join(out, 'follow-up.html'), f.html);
console.log('Wrote previews to email-previews/');
