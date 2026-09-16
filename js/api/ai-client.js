// ========================================
// AI BACKEND INTEGRATION LAYER (placeholder)
// ========================================
// GitHub Pages only serves static files, so this file MUST NEVER contain
// API keys, tokens, or secrets. Real AI calls belong on a secure backend
// (serverless function, small API server, etc.) that this file will call
// over HTTPS once it exists.
//
// HOW TO CONNECT A REAL BACKEND LATER:
// 1. Stand up a backend endpoint (e.g. a serverless function such as
//    Azure Functions, AWS Lambda, Cloudflare Workers, or a small Node/
//    Python API) that holds the real AI provider key server-side only.
// 2. Set BACKEND_BASE_URL below (or load it from a non-secret config file)
//    to point at that backend's public HTTPS URL.
// 3. Replace the body of diagnoseProblem() / analyzePhotos() with a
//    fetch() call to that backend, and remove the local demo logic.
// 4. The backend should accept the same request shape used here and
//    return the same response shape so the UI code above this layer
//    (js/modules/diagnosis.js) does not need to change.
//
// See BACKEND.md in the project root for a full description of the
// backend pieces required for a production AI diagnosis service.

import { diagnosisDatabase } from '../data/diagnosis-data.js';
import { classifyIntent, INTENT, INTENT_META, INTENTIONAL_ACTION_INTENTS, getIntentFollowUpQuestions } from '../data/intent-data.js';
import { assessRisk, RISK_LEVEL, RISK_BADGE_LABEL, matchesKeyword } from '../data/safety-data.js';
import {
  buildSessionFacts, applyFactsToCauses, filterAnsweredQuestions, conditionMatches
} from '../data/fact-data.js';

// ----------------------------------------------------------------------
// CONFIG: how the backend URL is resolved (no secrets, GitHub-Pages-safe)
// ----------------------------------------------------------------------
// The backend URL itself is not sensitive (it's just an endpoint address,
// not a credential), so it is safe to read from either of these
// non-secret, static-hosting-friendly sources:
//   1. A global `window.FIXWISE_CONFIG.backendUrl` set by a small,
//      un-committed config script (useful for local/staging overrides).
//   2. A `<meta name="fixwise-backend-url" content="...">` tag in
//      index.html (the default, checked-in mechanism — see the <head>).
// If neither is set, the app runs in Demo Mode using local logic only.
function resolveBackendBaseUrl() {
  if (typeof window === 'undefined') return null;
  if (window.FIXWISE_CONFIG && window.FIXWISE_CONFIG.backendUrl) {
    return String(window.FIXWISE_CONFIG.backendUrl).trim() || null;
  }
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="fixwise-backend-url"]');
    const content = meta && meta.getAttribute('content');
    if (content && content.trim()) return content.trim();
  }
  return null;
}

const BACKEND_BASE_URL = resolveBackendBaseUrl(); // null = Demo Mode

export const isBackendConnected = () => Boolean(BACKEND_BASE_URL);

/**
 * Analyze a described home repair problem.
 * @param {object} request
 * @param {string} request.category
 * @param {string} request.problem
 * @param {string} request.seen
 * @param {string} request.heard
 * @param {string} request.smell
 * @param {string} request.otherSymptoms
 * @param {File[]} request.photos
 * @param {Array<{answer: string, timestamp: string}>} [request.conversationHistory]
 *   Prior follow-up answers from this diagnosis session (with an ISO 8601
 *   timestamp for each), so a real backend can progressively narrow the
 *   diagnosis instead of treating every request as unrelated.
 * @returns {Promise<object>} diagnosis result object
 */
export async function diagnoseProblem(request) {
  if (isBackendConnected()) {
    // ------------------------------------------------------------------
    // REAL AI BACKEND CALL GOES HERE.
    // Example (uncomment and adapt once BACKEND_BASE_URL is set):
    //
    // const formData = new FormData();
    // formData.append('category', request.category);
    // formData.append('problem', request.problem);
    // formData.append('seen', request.seen);
    // formData.append('heard', request.heard);
    // formData.append('smell', request.smell);
    // formData.append('otherSymptoms', request.otherSymptoms);
    // formData.append('conversationHistory', JSON.stringify(request.conversationHistory || []));
    // request.photos.forEach(photo => formData.append('photos', photo));
    //
    // const response = await fetch(`${BACKEND_BASE_URL}/api/diagnose`, {
    //   method: 'POST',
    //   body: formData
    // });
    // if (!response.ok) throw new Error('Diagnosis request failed');
    // return await response.json();
    // ------------------------------------------------------------------
  }

  // ---- DEMO MODE: local keyword-matching stand-in (no AI, no network) ----
  return localDemoDiagnosis(request);
}

/**
 * Placeholder for future AI photo analysis. Currently returns an honest
 * "not yet analyzed" result rather than pretending to inspect the images,
 * per project requirements: never fake AI capability that doesn't exist.
 * @param {object} request
 * @param {File[]} request.photos
 */
export async function analyzePhotos({ photos }) {
  if (isBackendConnected()) {
    // Real backend photo analysis call would go here.
  }
  return {
    analyzed: false,
    photoCount: photos.length,
    note: photos.length
      ? `${photos.length} photo(s) attached and included with your description for a professional or future AI reviewer — automatic image analysis is not yet connected.`
      : 'No photos attached.'
  };
}

// Weights applied to each signal when estimating demo confidence below.
// Keyword hits are the strongest signal (they show the exact issue
// matched), filled-in description fields add a smaller weight each
// (more context, but not necessarily about *this* issue), and having any
// follow-up answer at all adds a flat bonus (shows narrowing occurred).
const KEYWORD_HIT_WEIGHT = 2;
const FILLED_FIELD_WEIGHT = 1;
const FOLLOW_UP_BONUS = 1;
const HIGH_CONFIDENCE_SIGNAL_SCORE = 7;
const MEDIUM_CONFIDENCE_SIGNAL_SCORE = 4;

/**
 * Estimate a simple, honest stand-in for a real AI confidence score: more
 * matched keywords and more filled-in fields means more informational
 * signal, so the label leans toward "likely" rather than "possible".
 * Never phrased as a certainty — see language requirements in
 * README.md/BACKEND.md. A real backend would replace this with a
 * model-reported score.
 * @param {number} filledFieldCount
 * @param {number} matchedKeywordHits
 * @param {boolean} hasFollowUp
 * @returns {{level: string, label: string}}
 */
function estimateConfidence(filledFieldCount, matchedKeywordHits, hasFollowUp) {
  const signalScore = (filledFieldCount * FILLED_FIELD_WEIGHT)
    + (matchedKeywordHits * KEYWORD_HIT_WEIGHT)
    + (hasFollowUp ? FOLLOW_UP_BONUS : 0);

  if (signalScore >= HIGH_CONFIDENCE_SIGNAL_SCORE) {
    return { level: 'high', label: 'Likely cause, based on the details you provided' };
  }
  if (signalScore >= MEDIUM_CONFIDENCE_SIGNAL_SCORE) {
    return { level: 'medium', label: 'Possible cause, based on the information provided so far' };
  }
  return { level: 'low', label: 'Low confidence — add more detail or answer a follow-up question to narrow this down' };
}

// Malfunction-signal words that suggest something is actually failing, even
// when the sentence is primarily phrased as an intentional action (e.g.
// "I want to replace my outlet because it sparks"). When these are present
// alongside an intentional-action intent, FixWise treats it as a repair-
// driven replacement rather than asking purely exploratory questions.
const MALFUNCTION_SIGNAL_WORDS = [
  'not working', "isn't working", 'broken', 'stopped working', 'failed', 'failing',
  'spark', 'shock', 'burn', 'burning', 'smoke', 'trip', 'tripping', 'leak', 'leaking',
  'drip', 'dripping', 'crack', 'cracked', 'won\'t', 'doesn\'t', 'no power', 'dead',
  'loose', 'warm to the touch', 'hot to the touch', 'buzzing', 'humming', 'rattling'
];

function hasMalfunctionSignal(text) {
  // Whole-word/phrase matching (shared with safety-data.js) — plain
  // substring checks would false-positive on words like "spark" matching
  // inside "sparkling", "trip" inside "triple", "dead" inside "deadline",
  // "crack" inside "crackers", or "loose" inside "moose".
  return MALFUNCTION_SIGNAL_WORDS.some(word => matchesKeyword(text, word));
}

// Fixy's philosophy in practice: when nothing is recognized at all (no risk
// signal, no intent, no knowledge-base match), FixWise should say so
// honestly and ask a useful, general question rather than invent an answer
// or simply dead-end with "no specific match". See README/BACKEND.md for
// the broader "ask, don't guess" principle applied throughout this file.
const GENERIC_UNKNOWN_QUESTIONS = [
  'What part of your home or which appliance/system is this about (e.g. a specific outlet, faucet, furnace, dryer, door)?',
  'Are you trying to fix something that stopped working, replace or install something new, or just understand how it works?',
  'What exactly are you seeing, hearing, or smelling that prompted this?'
];

// ----------------------------------------------------------------------
// Session-fact reasoning (js/data/fact-data.js): the demo engine's memory.
// Facts are extracted from each message separately — the original form
// fields AND every follow-up answer — so the diagnosis below can:
//   - pick the knowledge-base sub-issue that fits what is already known
//     (e.g. dryer no-heat vs dryer no-start),
//   - never re-ask a question the homeowner has already answered,
//   - drop causes that contradict established facts, and
//   - ask for clarification when a later answer contradicts an earlier one
//     instead of silently choosing one reading.
// ----------------------------------------------------------------------

// Human-readable phrasing for each fact key, used when a contradiction has
// to be turned into an honest clarifying question.
const FACT_LABELS = {
  runs: {
    earlier: 'it runs/turns on',
    latest: 'it won\'t turn on or start',
    question: 'Earlier you said it runs, but now it sounds like it won\'t turn on at all — which is it? Does it power on and run, or does it stay completely dead?'
  },
  heats: {
    earlier: 'it heats',
    latest: 'it doesn\'t heat',
    question: 'Earlier you mentioned heat, but now it sounds like there\'s no heat — does it produce any warmth at all, or none?'
  },
  drumTurns: {
    earlier: 'the dryer runs',
    latest: 'the drum doesn\'t turn',
    question: 'Just to clarify: do you hear the motor running but the drum stays still (which usually points to a broken belt), or does the drum turn normally while it runs?'
  },
  waterFlow: {
    earlier: 'water flows',
    latest: 'no water comes out',
    question: 'Earlier you mentioned water flowing, but now it sounds like no water comes out — does any water flow at all?'
  },
  drains: {
    earlier: 'it drains',
    latest: 'it doesn\'t drain',
    question: 'Earlier it sounded like drainage was fine, but now it sounds like it won\'t drain — does water drain away, even slowly?'
  },
  cools: {
    earlier: 'it cools',
    latest: 'it doesn\'t cool',
    question: 'Earlier you mentioned it cools, but now it sounds like it isn\'t cooling — does it produce any cold air at all?'
  },
  leakTiming: {
    earlier: 'the leak only happens while it runs',
    latest: 'the leak is constant',
    question: 'Just to clarify the leak: does it only leak while water is running / the appliance is on, or does it leak constantly, even when off?'
  },
  powerType: {
    earlier: 'it is one fuel type (gas or electric)',
    latest: 'the other fuel type',
    question: 'Just to double-check: is it gas or electric? Your answers mentioned both.'
  }
};

function contradictionQuestion(contradiction) {
  const label = FACT_LABELS[contradiction.key];
  if (label) return label.question;
  return `Earlier you said one thing about the ${contradiction.key}, but your latest answer seems to conflict — can you clarify which is correct?`;
}

// Pick the sub-issue of a knowledge-base entry that fits the known facts.
// `when` conditions must be fully satisfied (every referenced fact known);
// `notWhen` conditions exclude a sub-issue outright. While nothing has
// been established either way, `defaultSubIssue` is used.
function pickSubIssue(issueData, facts) {
  if (!issueData || !issueData.subIssues) return null;
  for (const sub of Object.values(issueData.subIssues)) {
    if (!sub.when) continue;
    if (sub.notWhen && conditionMatches(sub.notWhen, facts)) continue;
    if (conditionMatches(sub.when, facts)) return sub; // fully satisfied — a real match
  }
  const fallback = issueData.defaultSubIssue && issueData.subIssues[issueData.defaultSubIssue];
  if (fallback && !(fallback.notWhen && conditionMatches(fallback.notWhen, facts))) return fallback;
  return null;
}

/**
 * Reason over a matched knowledge-base issue using the session facts:
 * select the right sub-issue, drop causes that contradict known facts, and
 * filter out clarifying questions that are already answered. Returns a
 * NEW issue object — the shared knowledge-base entry is never mutated.
 */
function refineIssueWithFacts(issueData, facts) {
  const sub = pickSubIssue(issueData, facts);
  const source = sub ? { ...issueData, ...sub } : { ...issueData };
  delete source.subIssues;
  delete source.defaultSubIssue;

  const main = applyFactsToCauses(source.causes, facts);
  // Never show an empty cause list — if everything known-dependent was
  // ruled out or is still unknown, fall back to the hidden/contradicted
  // entries so the homeowner still has a starting point.
  source.causes = main.kept.length
    ? main.kept
    : main.hidden.concat(main.contradicted);
  const other = applyFactsToCauses(source.otherCauses, facts);
  // Causes contradicted by established facts are demoted to the "other"
  // list with an honest qualifier, rather than deleted or kept prominent.
  const demoted = main.contradicted
    .filter(text => !other.kept.includes(text))
    .map(text => `${text} (less likely based on what you've described)`);
  source.otherCauses = other.kept.concat(demoted);
  source.clarifyingQuestions = filterAnsweredQuestions(source.clarifyingQuestions, facts);
  return source;
}

function localDemoDiagnosis({ category, problem, seen, heard, smell, otherSymptoms, conversationHistory }) {
  const categoryKey = (category || '').toLowerCase();
  const categoryData = diagnosisDatabase[categoryKey];

  const followUpText = (conversationHistory || [])
    .map(entry => entry.answer)
    .filter(Boolean)
    .join(' ');

  const fields = [problem, seen, heard, smell, otherSymptoms, followUpText].filter(Boolean);
  const combinedText = fields.join(' ').toLowerCase();

  if (!combinedText.trim()) {
    return { matched: false, category };
  }

  // ---- 0. Session facts: what has the homeowner already told us? ----
  // Built from each message separately (original fields + every follow-up
  // answer, in order) so the diagnosis below reasons from what is already
  // known instead of re-asking it. `contradiction` is set when the LATEST
  // message conflicts with an earlier established fact.
  const { facts, subject, contradiction, clarification } = buildSessionFacts({
    problem, seen, heard, smell, otherSymptoms, conversationHistory
  });

  // ---- 1. Symptom-based risk assessment (independent of category/intent) ----
  const risk = assessRisk(combinedText);
  const hasDanger = risk.level === RISK_LEVEL.STOP || risk.level === RISK_LEVEL.HIGH;
  const dangerConfig = risk.signals.length
    ? {
      message: risk.signals.map(s => s.message).join(' '),
      badge: RISK_BADGE_LABEL[risk.level],
      action: risk.signals.map(s => s.action).join(' '),
      level: risk.level
    }
    : null;

  // ---- 2. Intent classification: what is the homeowner trying to DO? ----
  const intentResult = classifyIntent(combinedText);
  const intent = intentResult ? intentResult.intent : null;
  const intentMeta = intentResult ? intentResult.meta : null;

  // A true emergency-level risk always takes priority over everything else,
  // including an unrecognized category — stop and surface the safety
  // warning rather than any repair/replace guidance or a "no match" dead
  // end.
  if (risk.level === RISK_LEVEL.STOP) {
    return {
      matched: true,
      needsFollowUp: false,
      isEmergency: true,
      intent: INTENT.EMERGENCY,
      intentMeta: INTENT_META[INTENT.EMERGENCY],
      confidence: { level: 'high', label: 'High confidence this needs immediate professional/emergency attention' },
      hasDanger: true,
      dangerConfig,
      riskLevel: risk.level,
      issue: null,
      category
    };
  }

  // ---- 3. Does this look like an intentional action (replace/install/
  // maintenance/inspection/upgrade/how-it-works) rather than a malfunction
  // report? If so, and there's no malfunction language mixed in, FixWise
  // should ask a clarifying question rather than assume a failure. This is
  // the fix for "I want to replace my outlets" being treated like "my
  // outlet isn't working".
  const isIntentionalAction = intent && INTENTIONAL_ACTION_INTENTS.has(intent);
  const mentionsMalfunction = hasMalfunctionSignal(combinedText);

  // Shared shape for "ask a clarifying question instead of guessing" —
  // used both when the intent itself signals an intentional action, and
  // later when a recognized intent didn't match anything in the knowledge
  // base, so the two cases can't silently drift apart.
  const buildFollowUpResult = () => ({
    matched: true,
    needsFollowUp: true,
    intent,
    intentMeta,
    confidence: { level: 'low', label: 'Not enough detail yet to give a specific recommendation' },
    hasDanger,
    dangerConfig,
    riskLevel: risk.level,
    clarifyingQuestions: getIntentFollowUpQuestions(categoryKey, intent),
    category
  });

  // Shared shape for "nothing was recognized at all" — reuses any matched
  // risk signal's own clarifying questions (e.g. the CO2-vs-CO ambiguity
  // check) when present, or falls back to a genuinely honest "I don't know
  // yet — let's figure it out" set of general questions. Never a flat dead
  // end, and never an invented diagnosis. Used both when the category
  // itself isn't in the local knowledge base and when it is but nothing
  // inside it matched.
  //
  // `matched` intentionally stays `true` here (it means "FixWise has a
  // useful response to show", which the UI in js/modules/diagnosis.js
  // relies on to avoid its own flat "No specific match yet" dead end —
  // see the `!diagnosis.matched` check there). `recognized: false` is the
  // separate, honest signal for API consumers that need to know nothing
  // specific was actually identified (as opposed to `needsFollowUp` cases
  // where a real intent/issue/signal was found but needs more detail).
  const buildUnknownResult = () => {
    const signalFollowUps = risk.signals.flatMap(signal => signal.followUp || []);
    const clarifyingQuestions = signalFollowUps.length ? signalFollowUps : GENERIC_UNKNOWN_QUESTIONS;
    const recognized = Boolean(signalFollowUps.length || hasDanger || intent);
    return {
      matched: true,
      needsFollowUp: true,
      recognized,
      intent,
      intentMeta,
      confidence: { level: 'low', label: 'Not enough detail yet to give a specific recommendation' },
      hasDanger,
      dangerConfig,
      riskLevel: risk.level,
      clarifyingQuestions,
      category
    };
  };

  if (!categoryData) {
    return buildUnknownResult();
  }

  if (isIntentionalAction && !mentionsMalfunction) {
    return buildFollowUpResult();
  }

  // ---- 4. Malfunction / troubleshooting-style matching against the
  // knowledge base (also used when an intentional action turned out to be
  // driven by a described malfunction, e.g. "replacing a sparking outlet").
  let matchedIssue = null;
  let matchedKeywordHits = 0;
  if (categoryData.issues) {
    for (const [keyPattern, issueData] of Object.entries(categoryData.issues)) {
      const patterns = keyPattern.split('|').map(p => p.trim());
      const hits = patterns.filter(p => combinedText.includes(p)).length;
      if (hits > 0) {
        matchedIssue = issueData;
        matchedKeywordHits = hits;
        break;
      }
    }
  }

  if (!matchedIssue) {
    if (intent && !mentionsMalfunction) {
      // Recognized an intent (repair/troubleshoot-shaped) but nothing in the
      // knowledge base matched a specific known issue — ask rather than guess.
      return buildFollowUpResult();
    }

    // Nothing in the knowledge base matched AND no actionable intent was
    // classified (e.g. "My CO2 alarm is going off" — no "not working"/
    // "replace"/etc. wording for classifyIntent to key off of). Previously
    // this fell through to a flat "No specific match yet" dead end even
    // when a real (if lower-severity) risk signal like CO2 had already been
    // identified above.
    return buildUnknownResult();
  }

  // ---- 5. Contradiction / clarification check: if the LATEST answer
  // conflicts with a fact the homeowner established earlier, or introduces
  // a combination that needs distinguishing (motor runs vs drum turns),
  // ask them to clarify instead of silently choosing one reading. Safety
  // handling above (STOP risks) has already run, so this never delays an
  // emergency response.
  if (conversationHistory && conversationHistory.length && (contradiction || clarification)) {
    return {
      matched: true,
      needsFollowUp: true,
      recognized: true,
      hasContradiction: Boolean(contradiction),
      intent: intent || INTENT.TROUBLESHOOT,
      intentMeta: intentMeta || INTENT_META[INTENT.TROUBLESHOOT],
      confidence: { level: 'low', label: 'Your latest answer seems to conflict with an earlier one — clarification needed' },
      hasDanger,
      dangerConfig,
      riskLevel: risk.level,
      clarifyingQuestions: [contradiction ? contradictionQuestion(contradiction) : clarification],
      category
    };
  }

  // ---- 6. Refine the matched issue against the known session facts:
  // pick the sub-issue that fits (e.g. dryer no-heat vs no-start), drop
  // causes that contradict what the homeowner already said, and never
  // re-ask a clarifying question whose answer is already known.
  const refinedIssue = refineIssueWithFacts(matchedIssue, facts);

  const confidence = estimateConfidence(fields.length, matchedKeywordHits, Boolean(conversationHistory && conversationHistory.length));

  return {
    matched: true,
    needsFollowUp: false,
    intent: intent || INTENT.TROUBLESHOOT,
    intentMeta: intentMeta || INTENT_META[INTENT.TROUBLESHOOT],
    confidence,
    hasDanger,
    dangerConfig,
    riskLevel: risk.level,
    issue: refinedIssue,
    knownFacts: Object.fromEntries([...facts.entries()].map(([key, fact]) => [key, fact.value])),
    subject: subject || null,
    relatedGuideId: matchedIssue.relatedGuideId || refinedIssue.relatedGuideId || null,
    category
  };
}
