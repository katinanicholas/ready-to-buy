const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAssessment } = require('../scripts/load');
const A = loadAssessment();

const base = { q1: ['A'], q2: 'B', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'A', q8: 'E', q9: 'D' };
const w = (o) => Object.assign({}, base, o);
const plain = (x) => JSON.parse(JSON.stringify(x)); // vm arrays are from another realm
const path = (o) => A.determinePathway(w(o)).id;

// ------------------------------------------------------------ question data

test('nine questions, only Q1 is multi-select', () => {
  assert.equal(A.QUESTIONS.length, 9);
  assert.deepEqual(plain(A.QUESTIONS.map((q) => q.id)), ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']);
  assert.deepEqual(plain(A.QUESTIONS.filter((q) => q.multi).map((q) => q.id)), ['q1']);
  assert.deepEqual(plain(A.QUESTIONS.map((q) => q.options.length)), [4, 5, 4, 4, 4, 4, 4, 5, 5]);
});

test('approved wording is preserved (spot check every question)', () => {
  const p = A.QUESTIONS.map((q) => q.prompt);
  assert.equal(p[0], 'What has you thinking about buying a home right now?');
  assert.equal(p[1], 'When are you hoping to purchase a home?');
  assert.equal(p[2], 'Have you spoken with a mortgage lender about buying a home?');
  assert.equal(p[3], 'How comfortable are you with your current financial situation?');
  assert.equal(p[4], 'How much do you know about the costs involved in buying a home?');
  assert.equal(p[5], 'Have you thought about what monthly house payment would feel comfortable for you?');
  assert.equal(p[6], 'How much have you explored the types of homes or neighborhoods that would fit your needs?');
  assert.equal(p[7], "What's your biggest concern about buying a home right now?");
  assert.equal(p[8], 'What would help you feel more confident about buying a home?');
  assert.equal(A.optionText('q2', 'B'), 'Within 3\u20136 months.');
  assert.equal(A.optionText('q4', 'C'), 'I have concerns about my credit, savings, or debt.');
  assert.equal(A.optionText('q9', 'B'), 'Learning about financing and down payment assistance.');
});

test('approved pathway explanations and CTA copy', () => {
  assert.equal(A.PATHWAYS.ready.explanation, "Based on your answers, you're ready to start exploring your homebuying options. Next step, understand your purchasing power and make a plan that fits your goals.");
  assert.equal(A.PATHWAYS.facts.explanation, "Based on your answers, you're interested in homeownership but may need more information before moving forward. Your next step is to understand financing options, potential costs, and what makes sense for you.");
  assert.equal(A.PATHWAYS.prepare.explanation, 'Based on your answers, you may benefit from some preparation. Start by speaking with a mortgage lender to understand financing, and a Realtor to build a plan that fits your goals.');
  assert.equal(A.CTA.label, 'Schedule a Strategy Call with Katina Bodden');
  assert.equal(A.CTA.support, "Ready to take your next step? Let's discuss your results, answer your questions, and create a homebuying strategy that fits your goals.");
});

// ------------------------------------------------------------ validation

test('validateAnswers accepts a complete set and normalizes Q1', () => {
  const v = A.validateAnswers(w({ q1: ['C', 'A', 'C'] }));
  assert.equal(v.valid, true);
  assert.deepEqual(plain(v.answers.q1), ['A', 'C']);
});

test('validateAnswers rejects missing, invalid, and wrong-shape answers', () => {
  assert.equal(A.validateAnswers(null).valid, false);
  assert.equal(A.validateAnswers(w({ q1: [] })).valid, false);
  assert.equal(A.validateAnswers(w({ q1: 'A' })).valid, false);
  assert.equal(A.validateAnswers(w({ q1: ['Z'] })).valid, false);
  assert.equal(A.validateAnswers(w({ q2: ['A'] })).valid, false);
  assert.equal(A.validateAnswers(w({ q3: 'E' })).valid, false);
  const missing = Object.assign({}, base); delete missing.q9;
  assert.equal(A.validateAnswers(missing).valid, false);
});

test('unknown keys are dropped', () => {
  const v = A.validateAnswers(Object.assign(w({}), { evil: '<script>' }));
  assert.equal(v.valid, true);
  assert.equal('evil' in v.answers, false);
});

test('determinePathway throws on invalid answers', () => {
  assert.throws(() => A.determinePathway({}));
});

// ------------------------------------------------------------ representative profiles

test('Ready to Explore: prepared and preapproved', () => {
  assert.equal(path({}), 'ready');
});

test('Ready to Explore: prepared, not yet talked to lender, otherwise clear', () => {
  assert.equal(path({ q3: 'C' }), 'ready');
  assert.equal(path({ q3: 'D' }), 'ready'); // one gap allowed when Q4 = A
});

test('Ready to Explore: doing fairly well with no gaps', () => {
  assert.equal(path({ q4: 'B', q3: 'C', q5: 'B', q6: 'B', q8: 'C' }), 'ready');
});

test('Get the Facts First: unsure what finances need to look like', () => {
  assert.equal(path({ q4: 'D' }), 'facts');
});

test('Get the Facts First: doing fairly well but has information gaps', () => {
  assert.equal(path({ q4: 'B', q3: 'C', q6: 'C' }), 'facts');
  assert.equal(path({ q4: 'B', q3: 'C', q8: 'D' }), 'facts');
});

test('Get the Facts First: prepared but several open questions', () => {
  assert.equal(path({ q3: 'D', q5: 'D', q6: 'D' }), 'facts');
});

test('Prepare with Purpose: financial concerns, not preapproved', () => {
  assert.equal(path({ q4: 'C', q3: 'C', q8: 'B' }), 'prepare');
  assert.equal(path({ q4: 'C', q3: 'B' }), 'prepare');
  assert.equal(path({ q4: 'C', q3: 'D', q2: 'A' }), 'prepare');
});

// ------------------------------------------------------------ edge cases

test('financial concerns but already preapproved goes to Facts, not Prepare', () => {
  assert.equal(path({ q4: 'C', q3: 'A' }), 'facts');
});

test('long timeline alone does not make someone unprepared', () => {
  assert.equal(path({ q2: 'D' }), 'ready');
  assert.equal(path({ q2: 'D', q3: 'C' }), 'ready');
});

test('not having spoken with a lender alone does not make someone unprepared', () => {
  assert.equal(path({ q3: 'C' }), 'ready');
  assert.notEqual(path({ q4: 'B', q3: 'D' }), 'prepare');
});

test('still deciding (unsure timing + only exploring) routes to Facts', () => {
  assert.equal(path({ q1: ['D'], q2: 'E' }), 'facts');
  assert.equal(path({ q1: ['A', 'D'], q2: 'E' }), 'ready');  // has other motivation
  assert.equal(path({ q1: ['D'], q2: 'B' }), 'ready');       // has a timeline
});

test('doing fairly well with a money worry: Facts unless preapproved', () => {
  assert.equal(path({ q4: 'B', q3: 'C', q8: 'A' }), 'facts');
  assert.equal(path({ q4: 'B', q3: 'A', q8: 'A' }), 'ready');
});

test('contradictory answers resolve deterministically', () => {
  assert.equal(path({ q4: 'C', q3: 'C', q8: 'E' }), 'prepare'); // stated concerns win
  assert.equal(path({ q4: 'A', q8: 'B', q5: 'C' }), 'ready');   // one gap, prepared
});

// ------------------------------------------------------------ exhaustive properties

function* allAnswerSets() {
  const subsets = [];
  for (let m = 1; m < 16; m++) subsets.push(['A', 'B', 'C', 'D'].filter((_, i) => m & (1 << i)));
  const ids = (q) => A.getQuestion(q).options.map((o) => o.id);
  for (const q1 of subsets) for (const q2 of ids('q2')) for (const q3 of ids('q3')) for (const q4 of ids('q4'))
    for (const q5 of ids('q5')) for (const q6 of ids('q6')) for (const q7 of ['A']) for (const q8 of ids('q8')) for (const q9 of ['A'])
      yield { q1, q2, q3, q4, q5, q6, q7, q8, q9 };
}

test('exhaustive: every combination yields one of three pathways and the core principles hold', () => {
  let n = 0;
  const counts = { ready: 0, facts: 0, prepare: 0 };
  for (const a of allAnswerSets()) {
    const id = A.determinePathway(a).id;
    counts[id]++;
    n++;
    // Prepare only ever comes from self-reported financial concerns without preapproval.
    assert.equal(id === 'prepare', a.q4 === 'C' && a.q3 !== 'A');
    // Ready requires financial comfort.
    if (id === 'ready') assert.ok(a.q4 === 'A' || a.q4 === 'B');
    // Timeline never moves someone into or out of Prepare.
    for (const t of ['A', 'B', 'C', 'D', 'E']) {
      assert.equal(A.determinePathway(Object.assign({}, a, { q2: t })).id === 'prepare', id === 'prepare');
    }
    // A longer timeline never downgrades Ready (except the intent rule for 'not sure').
    if (id === 'ready') {
      for (const t of ['A', 'B', 'C', 'D']) assert.equal(A.determinePathway(Object.assign({}, a, { q2: t })).id, 'ready');
    }
  }
  assert.ok(n > 50000);
  assert.ok(counts.ready > 0 && counts.facts > 0 && counts.prepare > 0);
});

test('exhaustive: lender status among B/C/D never decides Prepare on its own', () => {
  for (const a of allAnswerSets()) {
    if (a.q3 === 'A') continue;
    const ids = ['B', 'C', 'D'].map((l) => A.determinePathway(Object.assign({}, a, { q3: l })).id === 'prepare');
    assert.ok(ids.every((x) => x === ids[0]));
  }
});

// ------------------------------------------------------------ report content

test('report has 3 steps, CTA, disclaimer, and no numeric score', () => {
  for (const id of ['ready', 'facts', 'prepare']) {
    const a = id === 'ready' ? w({}) : id === 'facts' ? w({ q4: 'D' }) : w({ q4: 'C', q3: 'C' });
    const r = A.buildReport(a);
    assert.equal(r.pathwayId, id);
    assert.equal(r.steps.length, 3);
    assert.equal(r.cta.label, 'Schedule a Strategy Call with Katina Bodden');
    assert.ok(r.disclaimer.includes('does not determine mortgage eligibility'));
    assert.equal('score' in r, false);
    const text = JSON.stringify([r.steps, r.concern, r.help, r.notes, r.explanation]);
    assert.ok(!/\b\d+\s*(\/|out of)\s*\d+\b/.test(text), 'no score-like text');
    assert.ok(!/%/.test(text), 'no percentages');
  }
});

test('approved next-step themes per pathway', () => {
  assert.deepEqual(plain(A.buildReport(w({})).steps.map((s) => s.title)),
    ['Clarify your buying power', 'Set your home, location, and payment priorities', 'Plan your search with Katina']);
  assert.deepEqual(plain(A.buildReport(w({ q4: 'D' })).steps.map((s) => s.title)),
    ['Explore financing and costs', 'Clarify a comfortable monthly payment, including taxes and insurance', 'Make a buying plan with Katina']);
  assert.deepEqual(plain(A.buildReport(w({ q4: 'C', q3: 'C' })).steps.map((s) => s.title)),
    ['Identify your preparation priority', 'Create a manageable plan', 'Explore lending options when appropriate']);
});

test('Q8 and Q9 change the personalized guidance', () => {
  const g8 = new Set(['A', 'B', 'C', 'D', 'E'].map((x) => A.buildReport(w({ q8: x })).concern.guidance));
  const g9 = new Set(['A', 'B', 'C', 'D', 'E'].map((x) => A.buildReport(w({ q9: x })).help.guidance));
  assert.equal(g8.size, 5);
  assert.equal(g9.size, 5);
});

test('preparation priority follows the top concern', () => {
  assert.match(A.buildReport(w({ q4: 'C', q3: 'C', q8: 'A' })).steps[0].body, /credit and qualifying/);
  assert.match(A.buildReport(w({ q4: 'C', q3: 'C', q8: 'B' })).steps[0].body, /savings/);
  assert.match(A.buildReport(w({ q4: 'C', q3: 'C', q8: 'C' })).steps[0].body, /budget/);
  assert.match(A.buildReport(w({ q4: 'C', q3: 'C', q8: 'D' })).steps[0].body, /knowledge/);
});

test('relocation and still-deciding notes appear from Q1', () => {
  assert.ok(A.buildReport(w({ q1: ['C'] })).notes.some((n) => /Relocating/.test(n)));
  assert.ok(A.buildReport(w({ q1: ['D'] })).notes.some((n) => /Still deciding/.test(n)));
  assert.equal(A.buildReport(w({ q1: ['A'] })).notes.length, 0);
});

test('report copy never promises approval or assistance eligibility', () => {
  const banned = [/you will qualify/i, /you qualify for (a|an|the) /i, /you are (pre)?approved for/i, /guarantee/i, /you are eligible/i, /you're eligible/i];
  for (const a of allAnswerSets()) {
    if (Math.random() > 0.02) continue; // sample ~2% for speed
    const r = A.buildReport(a);
    const text = JSON.stringify(r);
    banned.forEach((re) => assert.ok(!re.test(text), re + ' found'));
  }
});

test('answersForDisplay and encodeAnswers cover all nine questions', () => {
  const d = A.answersForDisplay(w({ q1: ['A', 'C'] }));
  assert.equal(d.length, 9);
  assert.match(d[0].answer, /^A\. .* \/ C\. /);
  assert.equal(A.encodeAnswers(w({ q1: ['C', 'A'] })), 'q1=A,C;q2=B;q3=A;q4=A;q5=A;q6=A;q7=A;q8=E;q9=D');
});
