# Testing checklist

Tick each box before launch. "Automated" items run with `npm test`. Everything else is manual.

## Automated (`npm test`): 46 tests

- [x] 9 questions, approved wording, only Q1 multi-select
- [x] Approved pathway explanations and CTA copy unchanged
- [x] Answer validation: missing, invalid, wrong shape, unknown keys
- [x] Representative profiles for all three pathways
- [x] Edge cases: preapproved with concerns, still deciding, money worry, contradictory answers
- [x] Exhaustive check of 96,000 answer combinations:
  - Prepare only from stated financial concerns without preapproval
  - Timeline never moves anyone into or out of Prepare
  - Lender status alone never decides Prepare
- [x] Q8 and Q9 change the guidance. No scores, percentages, or eligibility promises in any report.
- [x] Backend copy of the logic matches the site copy exactly
- [x] No secrets or keys in the public site
- [x] Server validation and bot signals (honeypot, too fast)
- [x] Report emails for all 3 pathways:
  - Name escaping, scheduling link, disclaimer, sender ID
  - Unsubscribe link only with consent
- [x] Missing scheduling link is stated, never faked
- [x] Follow-up uses the approved draft and refuses to render without an unsubscribe link
- [x] Notification has name, email, pathway, timeline, concern, help, consent, timestamp, all 9 responses
- [x] Mocked end to end:
  - Not configured: nothing sent
  - Success: 2 emails plus a row
  - Duplicates: no resend
  - Bots: nothing sent
  - Mail failure: reported as failure
  - TEST_MODE redirect and rate limit
- [x] Follow-up processing: sends only consented and due rows. Skips booked (manual or calendar) and unsubscribed. Never sends twice.

## Mobile layout

Test on a real phone, plus browser dev tools at each width.

- [ ] **360px:** no sideways scrolling on intro, every question, form, error, and results
- [ ] **390px:** same
- [ ] Every option row and button is easy to tap. Each is at least 44px tall.
- [ ] Email field brings up the email keyboard. iOS does not zoom when a field is tapped.
- [ ] Phone back button moves to the previous question instead of leaving the page
- [ ] Desktop (1280px+): content stays in a readable column. Top concern and help sit side by side.

## Accessibility

- [ ] Keyboard only:
  - Tab reaches every option. Arrow keys move within single-select questions. Space toggles Q1.
  - Enter goes to Next. Focus lands on each new question heading.
- [ ] Visible focus ring on every control
- [ ] Screen reader (VoiceOver or TalkBack):
  - Hears "Question 3 of 9" and the question
  - Hears errors on Next and on the form
  - Hears the confirmation message
- [ ] Next without an answer shows "Choose an answer to continue." Q1 shows "Choose at least one answer to continue."
- [ ] Form errors appear above the form, and each error links to its field
- [ ] Reduce Motion turned on in device settings: no animation on the progress bar or spinner
- [ ] Text zoom at 200%: nothing is cut off

## Quiz behavior

- [ ] Progress reads 1 of 9 through 9 of 9
- [ ] Going back keeps earlier answers, including Q1's multiple choices
- [ ] "Change my answers" on the form returns to Q9 with answers kept
- [ ] "Your Homebuyer Readiness Report is ready!" appears **before** any result is shown
- [ ] No phone number field anywhere

## Consent

- [ ] Optional checkbox is **unchecked** on every load and after "Start over"
- [ ] Report is sent whether the box is checked or not
- [ ] Unchecked: report email says no marketing emails, has no unsubscribe link, and the sheet row says `no consent`
- [ ] Checked: report has an unsubscribe link and the sheet row says `scheduled`
- [ ] Notification shows the correct consent state

## Backend, using TEST_MODE=true first

- [ ] `checkConfiguration` log shows nothing missing
- [ ] `<WEB_APP_URL>?action=health` returns `configured: true`
- [ ] `sendTestEmails`: all five arrive and look right in Gmail on phone and desktop
- [ ] Live submission from the site:
  - Report arrives with the correct pathway and steps for the answers given
  - Notification arrives, and Reply goes to the lead
  - Row appears in the Leads sheet
- [ ] Results page says "Your personalized Homebuyer Readiness Report is on its way!…" only after the server accepted it
- [ ] Double-tap "Email my report": only one email is sent
- [ ] Submit again with the same email within 10 minutes: no second email
- [ ] Follow-up: run `testRunFollowUpsNow`. The follow-up arrives, and the status becomes `sent …`.
- [ ] Follow-up suppression: tick **Booked (manual)** on another consented row and run again. Status becomes `suppressed: booked`.
- [ ] Unsubscribe link opens the confirmation page. The row shows Unsubscribed = TRUE.
- [ ] Scheduling button in the email and on the page opens your real scheduling page

## Failure handling

- [ ] Set `ENDPOINT_URL` to `''`. The test-mode banner and message appear, and the page says no email was sent.
- [ ] Turn on airplane mode and submit. The page shows "couldn't reach the server," with Try again.
- [ ] After 2 failures, "Show my results on this page" appears, and results show a warning that the report was not emailed
- [ ] Remove a required Script Property. The page says email delivery is not set up and that no email was sent.

## Launch

- [ ] `TEST_MODE` set to `false`
- [ ] `ENDPOINT_URL` set in `config.js`; `[date]` filled in `privacy.html`
- [ ] Broker reviewed disclosures and privacy notice
- [ ] One final real submission to a second inbox
