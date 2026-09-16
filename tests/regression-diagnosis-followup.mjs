// ========================================
// Regression test: diagnosis never dead-ends, and connects to repair guides
// ========================================
// Covers the core bug reported against the previous round: "My CO2 alarm is
// going off" (tested under both Electrical and Other categories) returned
// "No specific match yet" instead of FixWise's own CO2 caution info and a
// clarifying question. This exercises the full js/api/ai-client.js
// localDemoDiagnosis() flow (intent + risk + knowledge base together),
// complementing the lower-level checks in regression-co-vs-co2.mjs and
// regression-malfunction-signal.mjs.
//
// Run with: node tests/regression-diagnosis-followup.mjs
import assert from 'node:assert/strict';
import { diagnoseProblem } from '../js/api/ai-client.js';

const baseRequest = { seen: '', heard: '', smell: '', otherSymptoms: '', photos: [], conversationHistory: [] };

let pass = 0;
async function check(label, fn) {
  await fn();
  console.log(`PASS: ${label}`);
  pass += 1;
}

await check('"My CO2 alarm is going off" (Electrical) never dead-ends and offers a clarifying question, not a match', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Electrical', problem: 'My CO2 alarm is going off' });
  assert.equal(r.matched, true, 'should not be a flat "no match" dead end');
  assert.equal(r.needsFollowUp, true, 'should ask rather than guess');
  assert.equal(r.recognized, true, 'a real (if lower-severity) risk signal was identified, so this is not "genuinely unknown"');
  assert.equal(r.isEmergency, undefined, 'CO2 alone must never be treated as the CO emergency');
  assert.equal(r.riskLevel, 'caution');
  assert.ok(r.clarifyingQuestions && r.clarifyingQuestions.length > 0, 'must offer a useful follow-up question');
  assert.ok(r.clarifyingQuestions.some(q => /co2|carbon dioxide/i.test(q)), 'question should address the CO2-vs-CO ambiguity');
});

await check('"My CO2 alarm is going off" (Other) behaves the same as under Electrical', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Other', problem: 'My CO2 alarm is going off' });
  assert.equal(r.matched, true);
  assert.equal(r.needsFollowUp, true);
  assert.equal(r.riskLevel, 'caution');
});

await check('"My carbon monoxide alarm is going off" still triggers full emergency STOP guidance', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Electrical', problem: 'My carbon monoxide alarm is going off' });
  assert.equal(r.isEmergency, true);
  assert.equal(r.riskLevel, 'stop');
});

await check('"My CO alarm is going off" still triggers full emergency STOP guidance', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Electrical', problem: 'My CO alarm is going off' });
  assert.equal(r.isEmergency, true);
  assert.equal(r.riskLevel, 'stop');
});

await check('"I want to replace my outlets." is recognized as replacement intent, not a malfunction guess', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Electrical', problem: 'I want to replace my outlets.' });
  assert.equal(r.needsFollowUp, true);
  assert.equal(r.intent, 'replace');
});

await check('"My dryer runs but doesn\'t get hot." matches the dryer knowledge base entry with follow-up questions', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Appliance', problem: 'My dryer runs but doesn\'t get hot.' });
  assert.equal(r.matched, true);
  assert.ok(r.issue && r.issue.clarifyingQuestions.length > 0);
});

await check('"My kitchen sink is draining slowly and gurgling." gets plumbing diagnosis with a related guide when available', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Plumbing', problem: 'My kitchen sink is draining slowly and gurgling.' });
  assert.equal(r.matched, true);
  assert.ok(r.issue);
});

await check('A dripping-faucet style report links to the existing interactive repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Plumbing', problem: 'My faucet is dripping constantly.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'dripping-faucet');
});

await check('A repeatedly-tripping breaker report links to the GFCI/breaker repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Electrical', problem: 'My breaker keeps tripping.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'gfci-outlet-tripped');
});

await check('A refrigerator not cooling report links to the refrigerator repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Appliance', problem: 'My refrigerator is not cooling and I hear the compressor humming.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'refrigerator-not-cooling');
});

await check('A sticking door report links to the sticking door repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Doors & Windows', problem: 'My door is sticking and hard to open.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'sticking-door');
});

await check('A furnace not heating report links to the room-not-heating repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Heating & Cooling', problem: 'The furnace is not heating the room at all.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'room-not-heating');
});

await check('A drywall hole report links to the drywall-hole-repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Other', problem: 'There is a hole in the drywall from a doorknob.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'drywall-hole-repair');
});

await check('A squeaky floor report links to the squeaky-floorboard repair guide', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Other', problem: 'The hallway floor is squeaky when I walk on it.' });
  assert.equal(r.matched, true);
  assert.equal(r.relatedGuideId, 'squeaky-floorboard');
});

await check('Home Equipment no-start reports still resolve through the live diagnosis flow', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Home Equipment', problem: 'My generator will not start.' });
  assert.equal(r.matched, true);
  assert.equal(r.needsFollowUp, false);
  assert.ok(r.issue);
  assert.ok(r.issue.causes.includes('Dead or weak battery'));
  assert.ok(r.issue.steps.some(step => /battery|power source|fuel level/i.test(step)));
});

await check('Genuinely unrecognizable input gets an honest "figure it out together" follow-up, never a dead end', async () => {
  const r = await diagnoseProblem({ ...baseRequest, category: 'Other', problem: 'xyz zzz qqq' });
  assert.equal(r.matched, true);
  assert.equal(r.needsFollowUp, true);
  assert.equal(r.recognized, false, 'nothing specific was identified, unlike the CO2 case above');
  assert.ok(r.clarifyingQuestions && r.clarifyingQuestions.length > 0);
});

console.log(`\nregression-diagnosis-followup.mjs: ${pass}/${pass} passed`);
