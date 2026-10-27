# Am I Ready to Buy? The Homebuyer Readiness Assessment

A nine-question, mobile-first readiness assessment for Katina, Realtor, Epique Realty. It sorts each buyer into one of three pathways: **Ready to Explore**, **Get the Facts First**, or **Prepare with Purpose**. Then it does three things:

- Emails the buyer their personalized report.
- Notifies Katina in Gmail.
- With the buyer's consent only, sends one follow-up 48 hours later.

> **Status: not live until configured.** The site runs in a clearly labeled test mode until the backend URL and scheduling link are set. Nothing in this repo should be described as working until you complete "Launch checklist" and "End-to-end test" below.

---

## Before launch

Already filled in from your listing lookbooks and Epique email signature:

| Detail | Value | Where it's set |
|---|---|---|
| Scheduling link | `https://calendly.com/katinabodden/let-s-chat` | `config.js` + `loadKnownProperties()` |
| Notification email | `realbodden@gmail.com` | `loadKnownProperties()` |
| Licensed name | Katina Bodden (public CTA still says "Katina") | `config.js` + `loadKnownProperties()` |
| License | MS S-58840 | `config.js` + `loadKnownProperties()` |
| Cell / office | 228.346.6781 / 888.893.3537 | `config.js` + `loadKnownProperties()` |
| Privacy notice URL | `https://katinanicholas.github.io/ready-to-buy/privacy.html` | `loadKnownProperties()` (change if you use another repo name) |

| Brokerage office | Epique Realty, 520 Pass Rd Ste L, Gulfport, MS 39507 | `config.js`, `privacy.html` + `loadKnownProperties()` |

Still needed:

| Item | Where it goes | Notes |
|---|---|---|
| Backend URL | `docs/js/config.js` → `ENDPOINT_URL` and Script Property `WEB_APP_URL` | You get it when you deploy the Apps Script (step 6 below). |
| Privacy notice date | `docs/privacy.html` | Fill in `[date]`. Retention is set to 365 days. |
| Broker sign-off | n/a | Confirm the disclosures meet Epique and MREC advertising rules. |

---

## How it works

```
Buyer's phone ──► GitHub Pages (static: quiz, scoring, results screen)
                       │  POST JSON (text/plain, no secrets)
                       ▼
             Google Apps Script web app (runs as Katina's Google account)
               ├─ validates input, recomputes the pathway server-side
               ├─ spam checks: honeypot, timing, duplicate + rate limits, optional Turnstile
               ├─ MailApp → buyer's report email
               ├─ MailApp → Katina's Gmail notification
               ├─ Google Sheet "Homebuyer Readiness Leads" (lead log)
               ├─ hourly trigger → 48-hour follow-up (consent only, booked/unsubscribed suppressed)
               └─ daily trigger → deletes records older than RETENTION_DAYS
```

**Why Apps Script instead of a Cloudflare Worker?** Several reasons:
- It sends mail from your Gmail with no extra email vendor, API key, or DNS setup.
- Secrets live in Script Properties, which visitors can't see.
- It has built-in scheduled triggers for the follow-up.
- It's the same pattern as your Should I Sell scorecard.

**Honest limits.**
- Apps Script can't read the request origin or the visitor's IP. Rate limiting is global (per hour), not per visitor. Turnstile is the stronger bot defense if spam shows up.
- Gmail can't add a `List-Unsubscribe` header, so unsubscribe is a link in the email body.

### Files

```
docs/                     ← published by GitHub Pages
  index.html              page structure and all screens
  privacy.html            privacy notice (review before launch)
  css/styles.css          styles (brand teal #1A4744, brass #C4964A)
  js/config.js            PUBLIC settings: endpoint, scheduling link, disclosures. No secrets.
  js/assessment.js        questions, pathway rules, report copy (single source of truth)
  js/app.js               quiz flow, validation, submission, results
  .nojekyll
backend/apps-script/
  appsscript.json         manifest: scopes, web app access, time zone
  Code.gs                 intake, validation, sending, follow-up, unsubscribe, retention
  EmailTemplates.gs       report (all 3 pathways), notification, follow-up
  Setup.gs                setup(), checkConfiguration(), sendTestEmails(), testRunFollowUpsNow()
  Assessment.gs           GENERATED copy of docs/js/assessment.js. Never edit directly.
scripts/                  sync, local server, email previews, test loader
tests/                    unit, property, and mocked end-to-end tests
TESTING.md                QA checklist
```

### The pathway rules

Defined and commented in `docs/js/assessment.js` → `determinePathway`. In plain terms:

1. **Prepare with Purpose.** Q4 is "I have concerns about my credit, savings, or debt," *and* the buyer is not preapproved.
2. **Ready to Explore.** Q4 is "financially prepared" or "doing fairly well," and the buyer has few information gaps. Gaps are:
   - Q3: not sure where to start with a lender
   - Q5: worried about upfront cash, or unfamiliar with costs
   - Q6: needs help with the monthly cost, or hasn't thought about it
   - Q8: the process is the top concern

   Up to 1 gap is allowed if the buyer is financially prepared or preapproved. Zero gaps are allowed if they're "doing fairly well" and not preapproved. Two exclusions:
   - They're "doing fairly well," worried about qualifying or savings, and not preapproved.
   - They're still deciding: unsure of timing *and* only "exploring whether buying makes sense."
3. **Get the Facts First.** Everyone else.

Guarantees, enforced by exhaustive tests over every answer combination:
- Timeline never moves anyone into or out of Prepare.
- Lender status alone never puts anyone in Prepare.
- Only stated financial concerns do.

Q8 and Q9 drive the "top concern" and "what will help most" guidance. Q1, Q5, Q6, and Q7 personalize the next steps. No score is shown anywhere.

**Changing rules or copy.** Edit `docs/js/assessment.js` only. Then run `npm test`, which re-syncs the backend copy, and paste the new `Assessment.gs` into Apps Script.

---

## Local preview (no backend needed)

Requires Node 18+. No packages to install.

```bash
npm test               # syncs backend copy, runs all tests
npm run serve          # http://localhost:8080 (test mode banner shows)
npm run preview:emails # writes email-previews/*.html; open them in a browser
```

---

## Deploy the backend (Google Apps Script)

Do this while signed in to the Google account that should send the emails (realbodden@gmail.com).

1. Go to <https://script.google.com>, choose **New project**, and name it `Homebuyer Readiness Backend`.
2. Open **Project Settings** (gear icon):
   - Check **Show "appsscript.json" manifest file in editor**.
   - Set the time zone to **(GMT-06:00) Central Time**.
3. In the editor:
   - Replace `appsscript.json` with `backend/apps-script/appsscript.json`.
   - Rename `Code.gs` if needed and paste in `backend/apps-script/Code.gs`.
   - Add three files with **+ → Script** named `EmailTemplates`, `Setup`, and `Assessment`, and paste in the matching files.
   - Run `npm run sync` first so `Assessment.gs` is current.

   *Or, with the clasp command line tool:* run `npm i -g @google/clasp`, then `clasp login`, then `clasp create --type standalone --rootDir backend/apps-script`, then `clasp push`.
4. In the function dropdown, choose **`loadKnownProperties`** and click **Run**. It fills in every known value from the table above and turns on `TEST_MODE`. Values never appear on the website. You can review them under **Project Settings → Script Properties**. The full list, for reference:

   | Property | Required | Example / default |
   |---|---|---|
   | `NOTIFY_EMAIL` | yes | `realbodden@gmail.com` (preset) |
   | `SCHEDULING_URL` | yes | Calendly let's chat link (preset) |
   | `BROKERAGE_ADDRESS` | yes | `520 Pass Rd Ste L, Gulfport, MS 39507` (preset) |
   | `WEB_APP_URL` | yes | set in step 7 |
   | `SHEET_ID` | yes | set automatically by `setup()` |
   | `AGENT_LICENSED_NAME` | recommended | `Katina Bodden` (preset) |
| `AGENT_PHONE` | optional | `228.346.6781` (preset) |
   | `LICENSE_NUMBER` | recommended | `S-58840` |
   | `BROKERAGE_PHONE` | recommended | `888.893.3537` |
   | `PRIVACY_URL` | recommended | `https://<your-site>/privacy.html` |
   | `SENDER_NAME` | optional | `Katina \| Epique Realty` |
   | `TEST_MODE` | optional | `true` sends every buyer email to `NOTIFY_EMAIL` instead. Set to `false` at launch. |
   | `FOLLOW_UP_HOURS` | optional | `48` |
   | `RETENTION_DAYS` | optional | `365` |
   | `MAX_SUBMISSIONS_PER_HOUR` | optional | `40` |
   | `MIN_ELAPSED_MS` | optional | `15000` (submissions faster than this are treated as bots) |
   | `CALENDAR_ID` | optional | `primary` turns on follow-up suppression when a booking appears on your Google Calendar |
   | `TURNSTILE_SECRET` | optional | Cloudflare Turnstile secret key |

5. In the function dropdown, choose **`setup`** and click **Run**. Approve the permissions. Google warns "unverified app" for personal scripts; choose **Advanced → Go to project**. This does three things:
   - Creates the **Homebuyer Readiness Leads** sheet.
   - Saves its `SHEET_ID`.
   - Installs the hourly follow-up and daily cleanup triggers.
6. Click **Deploy → New deployment → Select type: Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and copy the URL that ends in **`/exec`**.
7. Paste that URL into two places:
   - The Script Property `WEB_APP_URL`, used for unsubscribe links.
   - `docs/js/config.js` → `ENDPOINT_URL`.

   That's the only line left to fill in `config.js`.
8. Run **`checkConfiguration`** and read the log. Then run **`sendTestEmails`** to get all five emails in your inbox for review.
9. Check the health endpoint: open `<WEB_APP_URL>?action=health`. It should show `{"ok":true,"configured":true,...}`.

**When you change backend code later:** go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The `/exec` URL stays the same. Creating a *new* deployment gives you a new URL instead.

### Email sender and deliverability

- Mail goes out from the Google account that owns the script. There's no separate sender verification to do. The display name is `SENDER_NAME`.
- To send from a different address, such as an Epique address, two things are needed. First, add it in Gmail under **Settings → Accounts → Send mail as** and verify it. Second, switch the `MailApp.sendEmail` calls in `Code.gs` to `GmailApp.sendEmail` with a `from` option. That change is not done here because it needs your verified alias.
- **Daily limit.** Free Gmail allows about 100 recipients per day through Apps Script. Each lead uses 2: the report and your notification. That's roughly 45 leads a day. A Google Workspace account raises this to 1,500. The backend checks the remaining quota before sending. When the quota runs out, it tells the buyer to try later. It never claims the email was sent.

### Costs

| Service | Cost |
|---|---|
| GitHub Pages | Free |
| Google Apps Script, Gmail, Google Sheets | Free (within quotas above) |
| Cloudflare Turnstile (optional) | Free |
| Custom domain (optional) | Your registrar's yearly fee |

---

## Deploy the site (GitHub Pages)

1. In your `katinanicholas` GitHub account, create a repository named `ready-to-buy` and upload this folder. It's the same steps as the lookbooks.
2. Go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Set **Branch: `main`, Folder: `/docs`**, then click **Save**.
3. After a minute or two, the site is live at `https://katinanicholas.github.io/ready-to-buy/`. `PRIVACY_URL` already points here.

### Optional custom domain

1. Add a file `docs/CNAME` containing only your subdomain, for example `ready.yourdomain.com`.
2. At your DNS provider, add a **CNAME** record from `ready` to `<username>.github.io`.
3. In **Settings → Pages**, enter the domain and check **Enforce HTTPS** once it's available.
4. Update `PRIVACY_URL`.

### Optional: Cloudflare Turnstile

Add this if spam gets through the built-in checks.

1. In the Cloudflare dashboard, go to **Turnstile → Add site** and add your Pages domain.
2. Put the **site key** in `config.js` → `TURNSTILE_SITE_KEY`.
3. Put the **secret key** in the Script Property `TURNSTILE_SECRET`. Never put it in the website.
4. Redeploy a new version of the Apps Script.

---

## Setting the scheduling link

It's preset to your Calendly link. To change it, update **both** places:
- `docs/js/config.js` → `SCHEDULING_URL`, for the results screen.
- Script Property `SCHEDULING_URL`, for all emails.

If either is missing, that surface shows "Scheduling link not configured." It never shows a made-up link.

## Follow-up and booking suppression

The follow-up is sent only when the buyer checked the optional box. It goes out about 48 hours later via the hourly trigger. It's skipped if any of these are true:
- They unsubscribed.
- You ticked **Booked (manual)** on their row in the Leads sheet.
- `CALENDAR_ID` is set and an event mentioning their email appears on that calendar. Booking tools that sync to Google Calendar usually add the invitee's email.

This makes no assumption about which booking tool or CRM you use. The manual column always works.

## Data handled

- **Stored in the Leads sheet:** timestamp, first name, email, pathway, the three summary answers, compact answer codes, consent state and wording, and follow-up status.
- **Not collected:** phone number, IP address, location, or analytics.
- Records are purged after `RETENTION_DAYS`.

---

## End-to-end test

See **TESTING.md** for the full checklist. The short version:

1. Set `TEST_MODE=true` in Script Properties.
2. Complete the quiz on your phone using a test email, and check the consent box.
3. You should receive the report, with a `[TEST for …]` subject, plus the notification. A row should appear in the sheet.
4. Run `testRunFollowUpsNow` in Apps Script and confirm the follow-up arrives. Click its unsubscribe link and confirm the status page.
5. Set `TEST_MODE=false` and repeat once with a real second inbox. Then launch.
