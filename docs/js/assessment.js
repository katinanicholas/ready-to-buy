/*
 * Am I Ready to Buy? Shared assessment definitions and logic.
 *
 * CANONICAL FILE. Edit this one only.
 * backend/apps-script/Assessment.gs is a generated copy (run `npm run sync`).
 * The browser, the Apps Script backend, and the Node tests all load this exact code,
 * so the on-screen report, the emailed report, and the tests cannot drift apart.
 *
 * Plain ES5-compatible script: no import/export, works in browsers, Apps Script (V8), and Node vm.
 */
var Assessment = (function () {
  'use strict';

  var VERSION = '1.0.0';

  // ---------------------------------------------------------------------------
  // 1. Approved questions. Wording and choices are approved copy. Do not edit.
  // ---------------------------------------------------------------------------
  var QUESTIONS = [
    {
      id: 'q1', multi: true, label: 'Motivation',
      prompt: 'What has you thinking about buying a home right now?',
      options: [
        { id: 'A', text: "I'm tired of renting and want a place of my own." },
        { id: 'B', text: 'I need a home that better fits my family or lifestyle.' },
        { id: 'C', text: "I'm relocating or going through a life change." },
        { id: 'D', text: "I'm exploring whether buying makes sense for me." }
      ]
    },
    {
      id: 'q2', label: 'Purchase timeline',
      prompt: 'When are you hoping to purchase a home?',
      options: [
        { id: 'A', text: 'Within the next 3 months.' },
        { id: 'B', text: 'Within 3\u20136 months.' },
        { id: 'C', text: 'Within 6\u201312 months.' },
        { id: 'D', text: 'More than a year from now.' },
        { id: 'E', text: "I'm not sure yet." }
      ]
    },
    {
      id: 'q3', label: 'Lender conversation',
      prompt: 'Have you spoken with a mortgage lender about buying a home?',
      options: [
        { id: 'A', text: "Yes, I've been preapproved." },
        { id: 'B', text: "Yes, but I haven't been preapproved." },
        { id: 'C', text: "No, but I'm planning to." },
        { id: 'D', text: "No, I'm not sure where to start." }
      ]
    },
    {
      id: 'q4', label: 'Financial comfort',
      prompt: 'How comfortable are you with your current financial situation?',
      options: [
        { id: 'A', text: 'I feel financially prepared to buy a home.' },
        { id: 'B', text: "I'm doing fairly well, but I have some questions." },
        { id: 'C', text: 'I have concerns about my credit, savings, or debt.' },
        { id: 'D', text: "I'm not sure what my finances need to look like to buy." }
      ]
    },
    {
      id: 'q5', label: 'Cost awareness',
      prompt: 'How much do you know about the costs involved in buying a home?',
      options: [
        { id: 'A', text: 'I understand the down payment, closing costs, and other expenses.' },
        { id: 'B', text: "I know a little, but I'd like a clearer picture." },
        { id: 'C', text: "I'm concerned about how much money I'll need upfront." },
        { id: 'D', text: "I'm not familiar with the costs involved." }
      ]
    },
    {
      id: 'q6', label: 'Monthly payment',
      prompt: 'Have you thought about what monthly house payment would feel comfortable for you?',
      options: [
        { id: 'A', text: 'Yes, I have a specific monthly amount in mind.' },
        { id: 'B', text: "I have a general idea, but I'm not sure what's realistic." },
        { id: 'C', text: "I've considered it, but I need help understanding the full monthly cost." },
        { id: 'D', text: "No, I haven't thought about that yet." }
      ]
    },
    {
      id: 'q7', label: 'Homes and neighborhoods',
      prompt: 'How much have you explored the types of homes or neighborhoods that would fit your needs?',
      options: [
        { id: 'A', text: "I know what I'm looking for and where." },
        { id: 'B', text: "I have some preferences, but I'm still comparing options." },
        { id: 'C', text: "I'm open to different homes and areas." },
        { id: 'D', text: "I haven't explored that yet." }
      ]
    },
    {
      id: 'q8', label: 'Biggest concern',
      prompt: "What's your biggest concern about buying a home right now?",
      options: [
        { id: 'A', text: 'Qualifying for a mortgage.' },
        { id: 'B', text: 'Having enough money saved.' },
        { id: 'C', text: 'Finding a home I can comfortably afford.' },
        { id: 'D', text: 'Understanding the buying process and making the right decisions.' },
        { id: 'E', text: "I don't have any major concerns right now." }
      ]
    },
    {
      id: 'q9', label: 'Requested help',
      prompt: 'What would help you feel more confident about buying a home?',
      options: [
        { id: 'A', text: 'Understanding what I can realistically afford.' },
        { id: 'B', text: 'Learning about financing and down payment assistance.' },
        { id: 'C', text: 'Having someone explain the buying process.' },
        { id: 'D', text: 'Exploring homes that fit my needs and budget.' },
        { id: 'E', text: 'Creating a plan to prepare for homeownership.' }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 2. Approved pathways and CTA copy.
  // ---------------------------------------------------------------------------
  var PATHWAYS = {
    ready: {
      id: 'ready',
      name: 'Ready to Explore',
      summary: 'Appears prepared to start exploring.',
      explanation: "Based on your answers, you're ready to start exploring your homebuying options. Next step, understand your purchasing power and make a plan that fits your goals."
    },
    facts: {
      id: 'facts',
      name: 'Get the Facts First',
      summary: 'Needs information about costs, financing, or process.',
      explanation: "Based on your answers, you're interested in homeownership but may need more information before moving forward. Your next step is to understand financing options, potential costs, and what makes sense for you."
    },
    prepare: {
      id: 'prepare',
      name: 'Prepare with Purpose',
      summary: 'May benefit from preparation before buying.',
      explanation: 'Based on your answers, you may benefit from some preparation. Start by speaking with a mortgage lender to understand financing, and a Realtor to build a plan that fits your goals.'
    }
  };

  var CTA = {
    label: 'Schedule a Strategy Call with Katina',
    support: "Ready to take your next step? Let's discuss your results, answer your questions, and create a homebuying strategy that fits your goals."
  };

  var DISCLAIMER = 'This assessment is for educational purposes only. It is not a loan application and does not determine mortgage eligibility, loan approval, or eligibility for down payment assistance. Only a licensed mortgage lender can determine loan qualification.';

  // ---------------------------------------------------------------------------
  // 3. Helpers and validation
  // ---------------------------------------------------------------------------
  function getQuestion(id) {
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i];
    return null;
  }

  function optionText(qid, optId) {
    var q = getQuestion(qid);
    if (!q) return '';
    for (var i = 0; i < q.options.length; i++) if (q.options[i].id === optId) return q.options[i].text;
    return '';
  }

  function isValidOption(q, id) {
    if (typeof id !== 'string') return false;
    for (var i = 0; i < q.options.length; i++) if (q.options[i].id === id) return true;
    return false;
  }

  /**
   * Validates and normalizes raw answers. Unknown keys are dropped.
   * Shape: { q1: ['A','C'], q2: 'B', ... q9: 'E' }
   * Returns { valid, errors, answers }
   */
  function validateAnswers(raw) {
    var errors = [];
    var out = {};
    if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Answers are missing.'], answers: {} };
    QUESTIONS.forEach(function (q) {
      var v = raw[q.id];
      if (q.multi) {
        if (!Array.isArray(v) || v.length === 0) { errors.push(q.id + ': choose at least one answer.'); return; }
        var seen = {};
        var list = [];
        for (var i = 0; i < v.length; i++) {
          if (!isValidOption(q, v[i])) { errors.push(q.id + ': invalid answer.'); return; }
          if (!seen[v[i]]) { seen[v[i]] = true; list.push(v[i]); }
        }
        out[q.id] = list.sort();
      } else {
        if (!isValidOption(q, v)) { errors.push(q.id + ': choose one answer.'); return; }
        out[q.id] = v;
      }
    });
    return { valid: errors.length === 0, errors: errors, answers: out };
  }

  // ---------------------------------------------------------------------------
  // 4. Pathway decision function. Transparent, rule based, editable.
  //
  // Principles (from the approved brief):
  //   * Financial readiness (Q4) matters more than timeline (Q2).
  //   * A long timeline alone never labels someone unprepared.
  //   * Not having spoken with a lender (Q3) alone never labels someone unprepared.
  //   * No numeric grade is shown to anyone. Gap counts are internal only.
  //
  // Rules, evaluated in order:
  //   R1  PREPARE  if Q4 = C (self-reported concerns about credit, savings, or debt)
  //                and Q3 != A (not yet preapproved). A preapproval means a lender has
  //                already reviewed their finances, so those buyers fall to R2/R3.
  //   R2  READY    if Q4 is A or B (financially comfortable) AND
  //                information gaps <= allowance AND
  //                not "still deciding" AND
  //                not (Q4 = B with a money worry in Q8 and no preapproval).
  //                Allowance = 1 when Q4 = A or Q3 = A, otherwise 0.
  //   R3  FACTS    everyone else (the default; an information need, not a judgment).
  //
  // Information gaps (internal count):
  //   Q3 = D (not sure where to start with a lender)
  //   Q5 = C or D (upfront cost worry, or unfamiliar with costs)
  //   Q6 = C or D (needs help with the full monthly cost, or hasn't thought about it)
  //   Q8 = D (biggest concern is understanding the process)
  //
  // "Still deciding" = Q2 = E (not sure on timing) AND Q1 is only D (exploring whether
  //   buying makes sense). This uses timeline for intent, never for financial readiness.
  //
  // Q1, Q5, Q6, Q7, Q9 add context and personalize the report. Q8 and Q9 drive the
  // "top concern" and "what will help" guidance.
  // ---------------------------------------------------------------------------
  var RULES = {
    gapAllowanceStrong: 1,   // Q4 = A, or preapproved
    gapAllowanceDefault: 0   // Q4 = B without preapproval
  };

  function informationGaps(a) {
    var gaps = [];
    if (a.q3 === 'D') gaps.push('lender_start');
    if (a.q5 === 'C' || a.q5 === 'D') gaps.push('upfront_costs');
    if (a.q6 === 'C' || a.q6 === 'D') gaps.push('monthly_cost');
    if (a.q8 === 'D') gaps.push('process');
    return gaps;
  }

  var GAP_TEXT = {
    lender_start: 'not sure where to start with a lender (Q3)',
    upfront_costs: 'wants clarity on upfront costs (Q5)',
    monthly_cost: 'wants help with the full monthly cost (Q6)',
    process: 'top concern is the buying process (Q8)'
  };

  function isStillDeciding(a) {
    return a.q2 === 'E' && Array.isArray(a.q1) && a.q1.length === 1 && a.q1[0] === 'D';
  }

  function determinePathway(answers) {
    var v = validateAnswers(answers);
    if (!v.valid) throw new Error('Invalid answers: ' + v.errors.join(' '));
    var a = v.answers;
    var preapproved = a.q3 === 'A';
    var gaps = informationGaps(a);
    var moneyWorry = a.q8 === 'A' || a.q8 === 'B';

    // R1
    if (a.q4 === 'C' && !preapproved) {
      return {
        id: 'prepare', rule: 'R1',
        reasons: ['Reported concerns about credit, savings, or debt (Q4) and is not yet preapproved (Q3).']
      };
    }

    // R2
    if (a.q4 === 'A' || a.q4 === 'B') {
      var allowance = (a.q4 === 'A' || preapproved) ? RULES.gapAllowanceStrong : RULES.gapAllowanceDefault;
      var deciding = isStillDeciding(a);
      var worryBlocks = a.q4 === 'B' && moneyWorry && !preapproved;
      if (gaps.length <= allowance && !deciding && !worryBlocks) {
        var r = ['Feels financially prepared or doing fairly well (Q4).'];
        if (preapproved) r.push('Already preapproved (Q3).');
        if (gaps.length) r.push('One open question: ' + gaps.map(function (g) { return GAP_TEXT[g]; }).join(', ') + '.');
        return { id: 'ready', rule: 'R2', reasons: r };
      }
      var why = [];
      if (gaps.length > allowance) why.push('Information needs: ' + gaps.map(function (g) { return GAP_TEXT[g]; }).join('; ') + '.');
      if (deciding) why.push('Still deciding whether buying makes sense, timing not set (Q1, Q2).');
      if (worryBlocks) why.push('Doing fairly well but worried about qualifying or savings, not yet preapproved (Q4, Q8, Q3).');
      return { id: 'facts', rule: 'R3', reasons: why };
    }

    // R3
    var reasons = [];
    if (a.q4 === 'D') reasons.push('Not sure what finances need to look like to buy (Q4).');
    if (a.q4 === 'C' && preapproved) reasons.push('Has financial concerns (Q4) but is already preapproved (Q3).');
    if (gaps.length) reasons.push('Information needs: ' + gaps.map(function (g) { return GAP_TEXT[g]; }).join('; ') + '.');
    return { id: 'facts', rule: 'R3', reasons: reasons };
  }

  // ---------------------------------------------------------------------------
  // 5. Personalized report content
  // ---------------------------------------------------------------------------
  var LENDER_LINE = {
    A: "You're preapproved. Confirm the amount still fits the monthly payment you're comfortable with, and note when the preapproval expires.",
    B: "You've talked with a lender. Completing preapproval gives you a firm price range and shows sellers you're ready. Katina can help you decide when that step makes sense.",
    C: 'When the timing is right, a lender can show what you can borrow. Katina can connect you with one.',
    D: "Not sure where to start with a lender? That's what the strategy call is for. Katina can explain how preapproval works and connect you with a lender when you're ready."
  };

  var HOME_LINE = {
    A: 'You know what you want and where. Next, test that list against real listings and your budget.',
    B: 'You have preferences. Narrow them to a short list of must-haves so comparing homes gets easier.',
    C: 'Being open gives you more options. Rank your must-haves so the right homes stand out.',
    D: 'Start with how you live: commute, space, schools, and the kind of neighborhood you want.'
  };

  var PAYMENT_LINE = {
    A: 'Keep your monthly number front and center. Make sure it includes property taxes, homeowners insurance, and flood insurance where required.',
    B: 'Check your general number against the full monthly cost: principal, interest, property taxes, insurance, and any HOA dues.',
    C: 'The full monthly cost includes principal, interest, property taxes, homeowners insurance, flood insurance where required, and any HOA dues. Katina can walk through it with you.',
    D: 'Pick a monthly payment that feels comfortable before you look at prices. Include property taxes and insurance, not just the loan.'
  };

  var TIMELINE_LINE = {
    A: 'Buying within 3 months? Map out the search, offer, and closing steps now so you can move when the right home lists.',
    B: 'A 3 to 6 month window gives you time to tour, compare, and be ready to act.',
    C: 'With 6 to 12 months, you have room to learn the market and line up financing without pressure.',
    D: 'More than a year out is a good runway. Use it to learn the market and get clear on your numbers.',
    E: 'Not sure about timing yet? A strategy call can help you set one that fits your goals.'
  };

  var COSTS_LINE = {
    A: "You know the main costs. Next, put real numbers to them for the price range you're considering.",
    B: 'Get a clear picture of the main costs: down payment, closing costs, and cash to keep in reserve.',
    C: 'Upfront cash is a common worry. Down payment requirements vary by loan type, and some buyers may be eligible for assistance programs. A lender can review the options with you.',
    D: 'Start with the basics: down payment, closing costs, inspections, and reserves. Katina can walk you through what each one covers.'
  };

  var FACTS_LENDER_LINE = {
    A: 'Your preapproval is a good starting point for these numbers.',
    B: 'Your lender can help put numbers to each of these.',
    C: 'Katina can connect you with a lender to put numbers to each of these.',
    D: 'Katina can connect you with a lender to put numbers to each of these.'
  };

  var PRIORITY = {
    credit: { label: 'Credit and qualifying', line: 'A lender can show which factors matter most for you, like credit history and debt, and what would help.' },
    savings: { label: 'Savings', line: 'Know your target for the down payment, closing costs, and reserves. Then build toward it.' },
    budget: { label: 'Your budget', line: 'Find a monthly payment that leaves room for the rest of your life, including taxes and insurance.' },
    knowledge: { label: 'Knowledge', line: 'Learn how the process works, step by step, so each decision feels clear.' },
    general: { label: 'Credit, savings, and debt', line: 'Start with the one that concerns you most. Small steady changes add up.' }
  };

  function preparationPriority(a) {
    if (a.q8 === 'A') return 'credit';
    if (a.q8 === 'B') return 'savings';
    if (a.q8 === 'C') return 'budget';
    if (a.q8 === 'D') return 'knowledge';
    if (a.q5 === 'C') return 'savings';
    return 'general';
  }

  var PLAN_LINE = {
    A: "You're hoping to buy soon. Pick the one or two steps that matter most and start this month.",
    B: "You're hoping to buy soon. Pick the one or two steps that matter most and start this month.",
    C: 'Your timeline gives you room. Break preparation into small monthly steps.',
    D: 'Your timeline gives you room. Break preparation into small monthly steps.',
    E: 'Set a target date, then work backward into small monthly steps.'
  };

  var CONCERN_GUIDANCE = {
    A: 'Only a lender can determine what you qualify for. A conversation now shows where you stand and what, if anything, to work on first.',
    B: 'Upfront costs include the down payment, closing costs, and reserves. Requirements vary by loan type, and some buyers may be eligible for assistance programs. A lender can review options with you.',
    C: "Comfortable is about the full monthly payment, not just the price. Principal, interest, taxes, insurance, and any HOA dues all count.",
    D: 'The process has clear stages: financing, search, offer, inspection, and closing. Katina can walk you through each one before you need it.',
    E: 'No major concerns is a strong place to start. Keep the momentum by setting clear priorities.'
  };

  var HELP_GUIDANCE = {
    A: "Katina can help you map a price range around a payment you're comfortable with, and connect you with a lender to confirm it.",
    B: 'Katina can connect you with a lender to review loan types and any down payment assistance programs you may be eligible to explore.',
    C: 'Katina can walk you through each step, from the first showing to closing day.',
    D: 'Katina can set up a home search around your needs and budget.',
    E: 'Katina can help you build a step-by-step plan toward homeownership.'
  };

  var DRIVER_LABEL = {
    A: 'Ready to stop renting',
    B: 'Needs a better fit for family or lifestyle',
    C: 'Relocating or going through a life change',
    D: 'Exploring whether buying makes sense'
  };

  function buildSteps(pathwayId, a) {
    if (pathwayId === 'ready') {
      return [
        { title: 'Clarify your buying power', body: LENDER_LINE[a.q3] },
        { title: 'Set your home, location, and payment priorities', body: HOME_LINE[a.q7] + ' ' + PAYMENT_LINE[a.q6] },
        { title: 'Plan your search with Katina', body: TIMELINE_LINE[a.q2] }
      ];
    }
    if (pathwayId === 'facts') {
      return [
        { title: 'Explore financing and costs', body: COSTS_LINE[a.q5] + ' ' + FACTS_LENDER_LINE[a.q3] },
        { title: 'Clarify a comfortable monthly payment, including taxes and insurance', body: PAYMENT_LINE[a.q6] },
        { title: 'Make a buying plan with Katina', body: TIMELINE_LINE[a.q2] }
      ];
    }
    var p = PRIORITY[preparationPriority(a)];
    var lenderNote = a.q3 === 'B'
      ? " You've already talked with a lender. Ask what would move you toward preapproval."
      : '';
    return [
      { title: 'Identify your preparation priority', body: 'Your priority: ' + p.label.toLowerCase() + '. ' + p.line },
      { title: 'Create a manageable plan', body: PLAN_LINE[a.q2] },
      { title: 'Explore lending options when appropriate', body: "A lender can review your situation and explain your options. Katina can connect you with one when you're ready." + lenderNote }
    ];
  }

  function buildNotes(a) {
    var notes = [];
    if (a.q1.indexOf('C') !== -1) notes.push('Relocating? Katina can help you compare Gulf Coast areas before you arrive.');
    if (a.q1.length === 1 && a.q1[0] === 'D') notes.push('Still deciding whether buying makes sense? A strategy call is a low-pressure way to compare renting and buying for your situation.');
    return notes;
  }

  /**
   * Builds the full personalized report used by the results screen, the report email,
   * and the lead notification.
   */
  function buildReport(answers) {
    var v = validateAnswers(answers);
    if (!v.valid) throw new Error('Invalid answers: ' + v.errors.join(' '));
    var a = v.answers;
    var decision = determinePathway(a);
    var p = PATHWAYS[decision.id];
    return {
      version: VERSION,
      pathwayId: p.id,
      pathwayName: p.name,
      pathwaySummary: p.summary,
      explanation: p.explanation,
      steps: buildSteps(p.id, a),
      concern: { answer: optionText('q8', a.q8), guidance: CONCERN_GUIDANCE[a.q8] },
      help: { answer: optionText('q9', a.q9), guidance: HELP_GUIDANCE[a.q9] },
      drivers: a.q1.map(function (id) { return DRIVER_LABEL[id]; }),
      notes: buildNotes(a),
      cta: { label: CTA.label, support: CTA.support },
      disclaimer: DISCLAIMER,
      decision: { rule: decision.rule, reasons: decision.reasons },
      summary: {
        timeline: optionText('q2', a.q2),
        lender: optionText('q3', a.q3),
        financial: optionText('q4', a.q4),
        concern: optionText('q8', a.q8),
        help: optionText('q9', a.q9)
      },
      answers: a
    };
  }

  /** Question/answer pairs for the lead notification. */
  function answersForDisplay(answers) {
    var a = validateAnswers(answers).answers;
    return QUESTIONS.map(function (q) {
      var ids = q.multi ? (a[q.id] || []) : [a[q.id]];
      return {
        id: q.id,
        question: q.prompt,
        answer: ids.map(function (id) { return id + '. ' + optionText(q.id, id); }).join(' / ')
      };
    });
  }

  /** Compact encoding for storage, e.g. "q1=A,C;q2=B;..." */
  function encodeAnswers(answers) {
    var a = validateAnswers(answers).answers;
    return QUESTIONS.map(function (q) {
      return q.id + '=' + (q.multi ? (a[q.id] || []).join(',') : a[q.id]);
    }).join(';');
  }

  return {
    VERSION: VERSION,
    QUESTIONS: QUESTIONS,
    PATHWAYS: PATHWAYS,
    CTA: CTA,
    DISCLAIMER: DISCLAIMER,
    RULES: RULES,
    getQuestion: getQuestion,
    optionText: optionText,
    validateAnswers: validateAnswers,
    informationGaps: informationGaps,
    determinePathway: determinePathway,
    buildReport: buildReport,
    answersForDisplay: answersForDisplay,
    encodeAnswers: encodeAnswers
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Assessment;
