/* Am I Ready to Buy? Client app. No frameworks, no storage, no secrets. */
(function () {
  'use strict';

  var cfg = window.APP_CONFIG || {};
  var A = window.Assessment;
  var Q = A.QUESTIONS;
  var TOTAL = Q.length;
  var REQUEST_TIMEOUT_MS = 30000;

  var state = {
    view: 'intro',
    index: 0,
    answers: {},
    startedAt: 0,
    submissionId: '',
    submitting: false,
    failures: 0,
    lastPayload: null,
    report: null,
    turnstileToken: ''
  };

  function $(id) { return document.getElementById(id); }

  var views = ['intro', 'question', 'gate', 'sending', 'error', 'result'];

  // ---------------------------------------------------------------- setup
  var endpointConfigured = isHttpsUrl(cfg.ENDPOINT_URL);
  var schedulingConfigured = isHttpsUrl(cfg.SCHEDULING_URL);

  function isHttpsUrl(u) {
    return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim());
  }

  function applyConfigText() {
    document.querySelectorAll('[data-config]').forEach(function (el) {
      var v = cfg[el.getAttribute('data-config')];
      if (v) el.textContent = v;
    });
    var parts = [];
    parts.push((cfg.AGENT_LICENSED_NAME || 'Katina') + ', licensed in ' + (cfg.LICENSE_STATE || 'Mississippi') +
      (cfg.LICENSE_NUMBER ? ', License ' + cfg.LICENSE_NUMBER : '') + '.');
    parts.push('Brokerage: ' + (cfg.BROKERAGE_NAME || 'Epique Realty') +
      (cfg.BROKERAGE_ADDRESS ? ', ' + cfg.BROKERAGE_ADDRESS : '') +
      (cfg.BROKERAGE_PHONE ? ', ' + cfg.BROKERAGE_PHONE : '') + '.');
    if (cfg.AGENT_PHONE || cfg.AGENT_EMAIL) {
      parts.push('Contact: ' + [cfg.AGENT_PHONE ? 'Cell ' + cfg.AGENT_PHONE : '', cfg.AGENT_EMAIL || ''].filter(Boolean).join(', ') + '.');
    }
    parts.push(A.DISCLAIMER);
    $('footer-disclosure').textContent = parts.join(' ');
    if (cfg.PRIVACY_URL) {
      $('privacy-link').href = cfg.PRIVACY_URL;
      $('footer-privacy').href = cfg.PRIVACY_URL;
    }
  }

  function showTestBanner() {
    var missing = [];
    if (!endpointConfigured) missing.push('ENDPOINT_URL');
    if (!schedulingConfigured) missing.push('SCHEDULING_URL');
    if (!missing.length) return;
    var b = $('test-banner');
    b.innerHTML = '';
    var s = document.createElement('strong');
    s.textContent = 'Test mode. ';
    b.appendChild(s);
    b.appendChild(document.createTextNode(
      'Not set in js/config.js: ' + missing.join(', ') + '. ' +
      (endpointConfigured ? '' : 'No emails will be sent and no leads will be recorded.')));
    b.hidden = false;
    if (window.console) console.warn('[Readiness] Test mode. Missing config:', missing.join(', '));
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  // ---------------------------------------------------------------- views
  function show(view, opts) {
    opts = opts || {};
    state.view = view;
    views.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    if (!opts.fromHistory) {
      var st = { view: view, index: state.index };
      if (opts.replace) history.replaceState(st, '');
      else history.pushState(st, '');
    }
    window.scrollTo(0, 0);
  }

  function focusEl(el) { if (el) { el.focus({ preventScroll: true }); } }

  function announce(msg) {
    var s = $('sr-status');
    s.textContent = '';
    setTimeout(function () { s.textContent = msg; }, 50);
  }

  // ---------------------------------------------------------------- questions
  function renderQuestion() {
    var q = Q[state.index];
    var n = state.index + 1;

    $('progress-text').textContent = 'Question ' + n + ' of ' + TOTAL;
    var bar = $('progress');
    bar.setAttribute('aria-valuenow', String(n));
    bar.setAttribute('aria-valuetext', 'Question ' + n + ' of ' + TOTAL);
    $('progress-fill').style.width = (n / TOTAL * 100).toFixed(2) + '%';

    $('question-title').textContent = q.prompt;
    $('question-hint').textContent = q.multi ? 'Choose all that apply.' : '';
    clearQuestionError();

    var box = $('options');
    box.innerHTML = '';
    var saved = state.answers[q.id];
    q.options.forEach(function (opt) {
      var label = document.createElement('label');
      label.className = 'option' + (q.multi ? ' option-multi' : '');
      var input = document.createElement('input');
      input.type = q.multi ? 'checkbox' : 'radio';
      input.name = q.id;
      input.value = opt.id;
      if (q.multi ? (saved || []).indexOf(opt.id) !== -1 : saved === opt.id) input.checked = true;
      input.addEventListener('change', onOptionChange);
      var letter = document.createElement('span');
      letter.className = 'letter';
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = opt.id;
      var text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = opt.text;
      label.appendChild(input);
      label.appendChild(letter);
      label.appendChild(text);
      box.appendChild(label);
    });

    $('next-btn').textContent = n === TOTAL ? 'See my report' : 'Next';
  }

  function onOptionChange() {
    var q = Q[state.index];
    var checked = Array.prototype.filter.call(
      $('options').querySelectorAll('input'), function (i) { return i.checked; }
    ).map(function (i) { return i.value; });
    if (q.multi) state.answers[q.id] = checked;
    else state.answers[q.id] = checked[0];
    clearQuestionError();
  }

  function clearQuestionError() {
    $('question-error').textContent = '';
    $('question-fieldset').removeAttribute('aria-invalid');
  }

  function currentAnswered() {
    var q = Q[state.index];
    var v = state.answers[q.id];
    return q.multi ? Array.isArray(v) && v.length > 0 : typeof v === 'string';
  }

  function goToQuestion(i, opts) {
    state.index = i;
    show('question', opts);
    renderQuestion();
    focusEl($('question-title'));
    announce('Question ' + (i + 1) + ' of ' + TOTAL);
  }

  function onNext(e) {
    e.preventDefault();
    if (!currentAnswered()) {
      var q = Q[state.index];
      $('question-error').textContent = q.multi ? 'Choose at least one answer to continue.' : 'Choose an answer to continue.';
      $('question-fieldset').setAttribute('aria-invalid', 'true');
      var first = $('options').querySelector('input');
      focusEl(first);
      return;
    }
    if (state.index < TOTAL - 1) goToQuestion(state.index + 1);
    else goToGate();
  }

  function onBack() {
    if (state.index === 0) { show('intro'); focusEl($('intro-title')); return; }
    goToQuestion(state.index - 1);
  }

  // ---------------------------------------------------------------- gate
  function goToGate(opts) {
    var v = A.validateAnswers(state.answers);
    if (!v.valid) { goToQuestion(firstUnanswered()); return; }
    state.report = A.buildReport(v.answers);
    if (!state.submissionId) state.submissionId = newId();
    show('gate', opts);
    focusEl($('gate-title'));
    maybeRenderTurnstile();
  }

  function firstUnanswered() {
    for (var i = 0; i < Q.length; i++) {
      var v = state.answers[Q[i].id];
      if (Q[i].multi ? !(Array.isArray(v) && v.length) : typeof v !== 'string') return i;
    }
    return 0;
  }

  var NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]{0,49}$/u;
  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

  function validateLead() {
    var name = $('first-name').value.trim().replace(/\s+/g, ' ');
    var email = $('email').value.trim();
    var errs = [];
    setFieldError('first-name', '');
    setFieldError('email', '');
    if (!name) errs.push(['first-name', 'Enter your first name.']);
    else if (!NAME_RE.test(name)) errs.push(['first-name', 'Use letters only, up to 50 characters.']);
    if (!email) errs.push(['email', 'Enter your email address.']);
    else if (email.length > 254 || !EMAIL_RE.test(email)) errs.push(['email', 'Enter an email address like name@example.com.']);
    errs.forEach(function (e) { setFieldError(e[0], e[1]); });
    return { ok: errs.length === 0, errs: errs, name: name, email: email };
  }

  function setFieldError(id, msg) {
    var input = $(id);
    $(id + '-error').textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function showFormSummary(errs) {
    var box = $('form-summary');
    if (!errs || !errs.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = errs.length === 1 ? 'Fix this to get your report:' : 'Fix these to get your report:';
    var ul = document.createElement('ul');
    errs.forEach(function (e) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + e[0];
      a.textContent = e[1];
      a.addEventListener('click', function (ev) { ev.preventDefault(); focusEl($(e[0])); });
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(p);
    box.appendChild(ul);
    box.hidden = false;
  }

  function onSubmitLead(e) {
    e.preventDefault();
    if (state.submitting) return;
    var v = validateLead();
    if (!v.ok) { showFormSummary(v.errs); focusEl($(v.errs[0][0])); return; }
    showFormSummary(null);

    if (cfg.TURNSTILE_SITE_KEY && !state.turnstileToken) {
      showFormSummary([['turnstile', 'Complete the quick check above the button, then try again.']]);
      return;
    }

    state.lastPayload = {
      submissionId: state.submissionId,
      firstName: v.name,
      email: v.email,
      answers: A.validateAnswers(state.answers).answers,
      marketingConsent: $('consent').checked === true,
      consentText: $('consent').nextElementSibling.textContent.trim(),
      company: $('company').value, // honeypot
      elapsedMs: Date.now() - state.startedAt,
      turnstileToken: state.turnstileToken,
      clientVersion: A.VERSION
    };

    if (!endpointConfigured) {
      showResult('test');
      return;
    }
    send();
  }

  function send() {
    state.submitting = true;
    $('submit-btn').disabled = true;
    $('retry-btn').disabled = true;
    show('sending', { replace: true });
    focusEl($('sending-title'));

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, REQUEST_TIMEOUT_MS);

    fetch(cfg.ENDPOINT_URL.trim(), {
      method: 'POST',
      // text/plain avoids a CORS preflight, which Apps Script cannot answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(state.lastPayload),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        handleResponse(data || {});
      })
      .catch(function (err) {
        clearTimeout(timer);
        handleFailure(err && err.name === 'AbortError' ? 'timeout' : 'network');
      })
      .then(function () {
        state.submitting = false;
        $('submit-btn').disabled = false;
        $('retry-btn').disabled = false;
      });
  }

  function handleResponse(data) {
    if (data.ok === true) {
      showResult('sent');
      return;
    }
    switch (data.code) {
      case 'invalid':
        show('gate', { replace: true });
        showFormSummary([['email', data.message || 'Check your name and email, then try again.']]);
        focusEl($('form-summary'));
        return;
      case 'not_configured':
        showResult('server-not-configured');
        return;
      case 'verification_failed':
        resetTurnstile();
        show('gate', { replace: true });
        showFormSummary([['turnstile', 'The quick check expired. Complete it again, then resend.']]);
        focusEl($('form-summary'));
        return;
      default:
        handleFailure(data.code || 'server');
    }
  }

  var FAILURE_TEXT = {
    timeout: 'The request took too long. Check your connection, then try again.',
    network: "The report couldn't reach the server. Check your connection, then try again.",
    rate_limited: 'A lot of reports went out in the last hour. Wait a few minutes, then try again.',
    quota: "Today's email limit was reached. Try again later today or tomorrow.",
    server: 'Something went wrong on the server. Try again in a minute.'
  };

  function handleFailure(code) {
    state.failures += 1;
    $('error-message').textContent = (FAILURE_TEXT[code] || FAILURE_TEXT.server) +
      ' Your answers are saved on this page, so you will not need to start over.';
    var limit = Number(cfg.RESULTS_ON_SCREEN_AFTER_FAILURES) || 2;
    $('show-anyway-btn').hidden = state.failures < limit;
    show('error', { replace: true });
    focusEl($('error-title'));
  }

  // ---------------------------------------------------------------- results
  function para(text, cls) {
    var p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    return p;
  }

  function showResult(mode) {
    var r = state.report;
    var status = $('delivery-status');
    status.innerHTML = '';
    status.className = 'delivery';
    if (mode === 'sent') {
      status.appendChild(para('Your personalized Homebuyer Readiness Report is on its way! Check your inbox for your results and recommended next steps.'));
      status.appendChild(para("Don't see it in a few minutes? Check your spam or promotions folder.", 'fine'));
    } else if (mode === 'test') {
      status.classList.add('is-warning');
      status.appendChild(para('Test mode: email delivery is not connected yet. No email was sent and no lead was recorded. Your results are below.'));
    } else if (mode === 'server-not-configured') {
      status.classList.add('is-warning');
      status.appendChild(para('Email delivery is not set up on the server yet, so no email was sent. Your results are below.'));
    } else if (mode === 'unsent') {
      status.classList.add('is-warning');
      status.appendChild(para('Your report was not emailed. Your results are below. You can also share them with Katina on a strategy call.'));
    }

    $('result-name').textContent = r.pathwayName;
    $('result-explanation').textContent = r.explanation;

    var notes = $('result-notes');
    notes.innerHTML = '';
    r.notes.forEach(function (n) { notes.appendChild(para(n, 'note')); });

    var ol = $('result-steps');
    ol.innerHTML = '';
    r.steps.forEach(function (s) {
      var li = document.createElement('li');
      var h = document.createElement('h4');
      h.textContent = s.title;
      li.appendChild(h);
      li.appendChild(para(s.body));
      ol.appendChild(li);
    });

    $('concern-answer').textContent = r.concern.answer;
    $('concern-guidance').textContent = r.concern.guidance;
    $('help-answer').textContent = r.help.answer;
    $('help-guidance').textContent = r.help.guidance;

    $('cta-support').textContent = r.cta.support;
    var slot = $('cta-slot');
    slot.innerHTML = '';
    if (schedulingConfigured) {
      var a = document.createElement('a');
      a.className = 'btn btn-cta';
      a.href = cfg.SCHEDULING_URL.trim();
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = r.cta.label;
      var srNew = document.createElement('span');
      srNew.className = 'sr-only';
      srNew.textContent = ' (opens in a new tab)';
      a.appendChild(srNew);
      slot.appendChild(a);
    } else {
      var box = document.createElement('div');
      box.className = 'cta-missing';
      var st = document.createElement('strong');
      st.textContent = r.cta.label;
      box.appendChild(st);
      box.appendChild(document.createTextNode('Scheduling link not configured. Set SCHEDULING_URL in js/config.js.'));
      slot.appendChild(box);
    }

    $('result-disclaimer').textContent = r.disclaimer;

    show('result', { replace: true });
    focusEl(status.childNodes.length ? status : $('result-name'));
  }

  // ---------------------------------------------------------------- turnstile (optional)
  var turnstileWidget = null;
  function maybeRenderTurnstile() {
    if (!cfg.TURNSTILE_SITE_KEY || turnstileWidget !== null) return;
    var box = $('turnstile');
    box.hidden = false;
    window.__onTurnstileLoad = function () {
      turnstileWidget = window.turnstile.render(box, {
        sitekey: cfg.TURNSTILE_SITE_KEY,
        callback: function (t) { state.turnstileToken = t; },
        'expired-callback': function () { state.turnstileToken = ''; },
        'error-callback': function () { state.turnstileToken = ''; }
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__onTurnstileLoad&render=explicit';
    s.async = true;
    document.head.appendChild(s);
  }
  function resetTurnstile() {
    state.turnstileToken = '';
    if (window.turnstile && turnstileWidget !== null) window.turnstile.reset(turnstileWidget);
  }

  // ---------------------------------------------------------------- wiring
  function start() {
    state.answers = {};
    state.startedAt = Date.now();
    state.submissionId = '';
    state.failures = 0;
    state.report = null;
    $('lead-form').reset();
    showFormSummary(null);
    goToQuestion(0);
  }

  $('start-btn').addEventListener('click', start);
  $('question-form').addEventListener('submit', onNext);
  $('back-btn').addEventListener('click', onBack);
  $('lead-form').addEventListener('submit', onSubmitLead);
  $('edit-answers-btn').addEventListener('click', function () { goToQuestion(TOTAL - 1); });
  $('retry-btn').addEventListener('click', function () { if (!state.submitting) send(); });
  $('show-anyway-btn').addEventListener('click', function () { showResult('unsent'); });
  $('restart-btn').addEventListener('click', function () { show('intro'); focusEl($('intro-title')); });

  // Browser back button moves through the quiz instead of leaving the page.
  window.addEventListener('popstate', function (e) {
    var st = e.state;
    if (state.view === 'sending' || state.view === 'result') {
      history.pushState({ view: state.view, index: state.index }, '');
      return;
    }
    if (!st) return;
    if (st.view === 'question') { state.index = st.index; show('question', { fromHistory: true }); renderQuestion(); focusEl($('question-title')); }
    else if (st.view === 'gate' && A.validateAnswers(state.answers).valid) goToGate({ fromHistory: true });
    else if (st.view === 'intro') { show('intro', { fromHistory: true }); }
  });

  applyConfigText();
  showTestBanner();
  history.replaceState({ view: 'intro', index: 0 }, '');
})();
