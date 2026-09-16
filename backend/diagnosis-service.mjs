const ALLOWED_SCOPE = 'home-diy-only';

const SUPPORTED_HOME_CATEGORIES = new Set([
  'Plumbing',
  'Electrical',
  'Heating & Cooling',
  'Appliance',
  'Structural',
  'Home Equipment',
  'Doors & Windows',
  'Other'
]);

const DANGER_RULES = [
  {
    level: 'stop',
    badge: 'Emergency',
    pattern: /(gas leak|smell gas|rotten egg|carbon monoxide|co alarm|fire|smoke|sparking|arcing|electrical shock|shock hazard|breaker keeps tripping|panel is hot|burning smell|flames?)/i,
    message: 'STOP now and move to safety. This could involve fire, gas, or dangerous electrical risk.',
    action: 'Call emergency services or your utility provider, then contact a licensed professional.'
  },
  {
    level: 'stop',
    badge: 'Professional only',
    pattern: /(asbestos|lead paint|black mold|sewage|major flood|standing water near electrical|collapsed|structural crack|sagging ceiling)/i,
    message: 'STOP DIY work. This situation may involve structural or hazardous-material risk.',
    action: 'Contact a licensed professional for inspection and remediation.'
  }
];

function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values, limit = 8) {
  return Array.from(new Set(toArray(values).map(toText).filter(Boolean))).slice(0, limit);
}

function compactObject(record) {
  if (!record || typeof record !== 'object') return null;
  const result = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    result[key] = value;
  });
  return Object.keys(result).length ? result : null;
}

function normalizeEquipment(equipment = {}) {
  return compactObject({
    make: toText(equipment.make),
    model: toText(equipment.model)
  }) || {};
}

function normalizeSymptoms(symptoms = {}) {
  return compactObject({
    seen: toText(symptoms.seen),
    heard: toText(symptoms.heard),
    smell: toText(symptoms.smell),
    leakDetails: toText(symptoms.leakDetails),
    errorCode: toText(symptoms.errorCode),
    intermittentBehavior: toText(symptoms.intermittentBehavior),
    problemStart: toText(symptoms.problemStart),
    otherSymptoms: toText(symptoms.otherSymptoms)
  }) || {};
}

function normalizeConversation(entries) {
  return toArray(entries)
    .map(entry => ({
      answer: toText(entry?.answer),
      timestamp: toText(entry?.timestamp)
    }))
    .filter(entry => entry.answer)
    .slice(0, 25);
}

function normalizeMyHomeContext(context = {}) {
  if (!context || typeof context !== 'object') return null;
  const selectedEquipment = compactObject({
    id: toText(context?.selectedEquipment?.id),
    type: toText(context?.selectedEquipment?.type),
    manufacturer: toText(context?.selectedEquipment?.manufacturer),
    modelNumber: toText(context?.selectedEquipment?.modelNumber),
    serialNumber: toText(context?.selectedEquipment?.serialNumber),
    installationDateOrAge: toText(context?.selectedEquipment?.installationDateOrAge),
    warrantyExpiration: toText(context?.selectedEquipment?.warrantyExpiration),
    warrantyDetails: toText(context?.selectedEquipment?.warrantyDetails),
    notes: toText(context?.selectedEquipment?.notes)
  });

  const maintenanceHistory = toArray(context.maintenanceHistory)
    .map(item => compactObject({
      recordType: toText(item?.recordType),
      servicePerformed: toText(item?.servicePerformed),
      date: toText(item?.date),
      partsUsed: toText(item?.partsUsed),
      notes: toText(item?.notes)
    }))
    .filter(Boolean)
    .slice(0, 20);

  const previousRepairs = toArray(context.previousRepairs)
    .map(item => compactObject({
      recordType: toText(item?.recordType),
      servicePerformed: toText(item?.servicePerformed),
      date: toText(item?.date),
      partsUsed: toText(item?.partsUsed),
      notes: toText(item?.notes)
    }))
    .filter(Boolean)
    .slice(0, 20);

  const homeSummary = compactObject({
    nickname: toText(context?.homeSummary?.nickname),
    yearBuilt: toText(context?.homeSummary?.yearBuilt),
    homeType: toText(context?.homeSummary?.homeType)
  });

  const normalized = compactObject({
    profileUpdatedAt: toText(context.profileUpdatedAt),
    selectedEquipment,
    maintenanceHistory,
    previousRepairs,
    homeSummary
  });

  return normalized || null;
}

function assert(condition, status, message) {
  if (!condition) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

export function validateAndNormalizeDiagnosisPayload(rawPayload) {
  assert(rawPayload && typeof rawPayload === 'object', 400, 'Invalid request payload.');

  const scope = toText(rawPayload.scope);
  assert(scope === ALLOWED_SCOPE, 400, 'Unsupported scope. This endpoint only supports home-diy-only requests.');

  const category = toText(rawPayload.category);
  assert(!category || SUPPORTED_HOME_CATEGORIES.has(category), 400, 'Unsupported category for home/DIY diagnosis.');

  const problem = toText(rawPayload.problem);
  const areaOrEquipment = toText(rawPayload.areaOrEquipment);
  assert(problem || areaOrEquipment, 400, 'Problem description or area/equipment is required.');

  const payload = {
    version: toText(rawPayload.version),
    scope,
    category,
    areaOrEquipment,
    equipment: normalizeEquipment(rawPayload.equipment),
    problem,
    symptoms: normalizeSymptoms(rawPayload.symptoms),
    conversationHistory: normalizeConversation(rawPayload.conversationHistory),
    useMyHomeContext: Boolean(rawPayload.useMyHomeContext),
    myHomeContext: normalizeMyHomeContext(rawPayload.myHomeContext),
    requestedOutputs: rawPayload.requestedOutputs && typeof rawPayload.requestedOutputs === 'object'
      ? rawPayload.requestedOutputs
      : {},
    disclaimers: rawPayload.disclaimers && typeof rawPayload.disclaimers === 'object'
      ? rawPayload.disclaimers
      : {}
  };

  if (payload.useMyHomeContext && !payload.myHomeContext?.selectedEquipment) {
    payload.useMyHomeContext = false;
    payload.myHomeContext = null;
  }

  return payload;
}

function collectRiskText(payload) {
  const pool = [
    payload.category,
    payload.areaOrEquipment,
    payload.problem,
    payload.symptoms?.seen,
    payload.symptoms?.heard,
    payload.symptoms?.smell,
    payload.symptoms?.leakDetails,
    payload.symptoms?.errorCode,
    payload.symptoms?.intermittentBehavior,
    payload.symptoms?.problemStart,
    payload.symptoms?.otherSymptoms,
    ...payload.conversationHistory.map(entry => entry.answer)
  ].filter(Boolean);
  return pool.join(' ').toLowerCase();
}

export function detectImmediateSafetyStop(payload) {
  const riskText = collectRiskText(payload);
  return DANGER_RULES.find(rule => rule.pattern.test(riskText)) || null;
}

export function buildSafetyStopResponse(payload, dangerRule) {
  const callNow = [
    'Call a licensed professional before attempting further repair.',
    'If anyone feels unwell, move to fresh air and seek medical help immediately.'
  ];

  return {
    matched: true,
    needsFollowUp: false,
    confidence: {
      level: 'high',
      label: 'High-confidence safety alert from the symptoms provided'
    },
    hasDanger: true,
    isEmergency: true,
    dangerConfig: {
      level: dangerRule.level,
      badge: dangerRule.badge,
      message: dangerRule.message,
      action: dangerRule.action
    },
    possibleCauses: [
      {
        title: 'Potential immediate hazard',
        whyPossible: 'Your description includes high-risk safety signals that should not be handled as DIY troubleshooting.'
      }
    ],
    otherPossibleCauses: [],
    safeChecks: ['Do not continue repair work until the area is confirmed safe by a professional.'],
    nextActions: ['Stop work immediately and secure the area.', dangerRule.action],
    tools: ['Phone to contact emergency services or a licensed professional'],
    parts: [],
    safetyWarnings: [dangerRule.message],
    whenToStopDIY: [dangerRule.message],
    whenToCallProfessional: callNow,
    followUpQuestions: [],
    issue: {
      causes: ['Potential immediate hazard'],
      otherCauses: [],
      clarifyingQuestions: [],
      nextCheck: 'Pause DIY troubleshooting and prioritize safety.',
      steps: ['Stop work and move to a safe location.', dangerRule.action],
      tools: ['Phone to contact emergency services or a licensed professional'],
      parts: [],
      time: 'Immediate',
      difficulty: 'emergency',
      tips: ['Do not restore power, relight appliances, or continue testing until cleared by a professional.'],
      stopWhen: dangerRule.message,
      safety: dangerRule.message,
      pro: callNow.join(' ')
    },
    category: payload.category || 'Other'
  };
}

function buildSystemPrompt() {
  return [
    'You are A to Z Wise AI secure diagnosis backend for HOME/DIY ONLY.',
    'Never provide automotive diagnosis.',
    'Safety is highest priority. If there is any risk of electrical shock, gas leak, fire, carbon monoxide, structural failure, hazardous material, sewage, or active flooding, clearly instruct STOP and call emergency/professional help.',
    'Never claim certainty. Use words like possible/likely.',
    'Never invent equipment details. Use only provided My Home data.',
    'Return strict JSON only with keys: matched, needsFollowUp, confidence, hasDanger, dangerConfig, possibleCauses, otherPossibleCauses, safeChecks, nextActions, tools, parts, safetyWarnings, whenToStopDIY, whenToCallProfessional, followUpQuestions, issue, category.',
    'possibleCauses and otherPossibleCauses must be arrays of objects with title and whyPossible.',
    'issue must include: causes, otherCauses, clarifyingQuestions, nextCheck, steps, tools, parts, time, difficulty, tips, stopWhen, safety, pro.',
    'If more information is required, set needsFollowUp=true and return concise followUpQuestions.'
  ].join(' ');
}

function buildUserPrompt(payload) {
  return JSON.stringify({
    task: 'Produce a structured, safety-first home diagnosis response.',
    constraints: {
      scope: payload.scope,
      homeOnly: true,
      noAutomotive: true,
      noCertainty: true,
      useProvidedMyHomeOnly: true
    },
    request: payload
  });
}

function extractJsonFromModelText(text) {
  const trimmed = toText(text);
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    return {};
  }
}

function normalizePossibleCauses(rawValue, fallbackWhy) {
  return toArray(rawValue)
    .map(item => {
      if (typeof item === 'string') {
        const title = toText(item);
        if (!title) return null;
        return { title, whyPossible: fallbackWhy };
      }
      const title = toText(item?.title || item?.name || item?.cause);
      if (!title) return null;
      return {
        title,
        whyPossible: toText(item?.whyPossible) || fallbackWhy
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeDifficulty(value) {
  const allowed = new Set(['easy-check', 'beginner', 'intermediate', 'advanced', 'professional', 'emergency']);
  const normalized = toText(value).toLowerCase();
  return allowed.has(normalized) ? normalized : 'professional';
}

export function normalizeProviderDiagnosis(rawResponse, payload) {
  const fallbackWhy = 'Possible from the symptom pattern you described.';
  const possibleCauses = normalizePossibleCauses(rawResponse?.possibleCauses, fallbackWhy);
  const otherPossibleCauses = normalizePossibleCauses(rawResponse?.otherPossibleCauses, fallbackWhy);
  const safeChecks = uniqueStrings(rawResponse?.safeChecks, 8);
  const nextActions = uniqueStrings(rawResponse?.nextActions, 8);
  const tools = uniqueStrings(rawResponse?.tools, 8);
  const parts = uniqueStrings(rawResponse?.parts, 8);
  const safetyWarnings = uniqueStrings(rawResponse?.safetyWarnings, 6);
  const whenToStopDIY = uniqueStrings(rawResponse?.whenToStopDIY, 6);
  const whenToCallProfessional = uniqueStrings(rawResponse?.whenToCallProfessional, 6);
  const followUpQuestions = uniqueStrings(rawResponse?.followUpQuestions, 4);

  const issue = rawResponse?.issue && typeof rawResponse.issue === 'object' ? rawResponse.issue : {};
  const difficulty = normalizeDifficulty(issue.difficulty || rawResponse?.difficulty);

  const normalized = {
    matched: Boolean(rawResponse?.matched ?? (possibleCauses.length || followUpQuestions.length)),
    needsFollowUp: Boolean(rawResponse?.needsFollowUp ?? followUpQuestions.length),
    confidence: {
      level: ['high', 'medium', 'low'].includes(toText(rawResponse?.confidence?.level).toLowerCase())
        ? toText(rawResponse?.confidence?.level).toLowerCase()
        : (followUpQuestions.length ? 'low' : 'medium'),
      label: toText(rawResponse?.confidence?.label)
        || (followUpQuestions.length
          ? 'Possible causes identified, but more detail is needed to narrow the diagnosis.'
          : 'Likely causes based on the details provided so far.')
    },
    hasDanger: Boolean(rawResponse?.hasDanger || safetyWarnings.length || whenToStopDIY.length),
    dangerConfig: compactObject({
      level: toText(rawResponse?.dangerConfig?.level) || (whenToStopDIY.length ? 'caution' : ''),
      badge: toText(rawResponse?.dangerConfig?.badge) || (whenToStopDIY.length ? 'Safety note' : ''),
      message: toText(rawResponse?.dangerConfig?.message) || safetyWarnings[0] || '',
      action: toText(rawResponse?.dangerConfig?.action)
    }) || null,
    possibleCauses,
    otherPossibleCauses,
    safeChecks,
    nextActions,
    tools,
    parts,
    safetyWarnings,
    whenToStopDIY,
    whenToCallProfessional,
    followUpQuestions,
    issue: {
      causes: possibleCauses.map(item => item.title),
      otherCauses: otherPossibleCauses.map(item => item.title),
      clarifyingQuestions: followUpQuestions,
      nextCheck: toText(issue.nextCheck) || followUpQuestions[0] || 'Review the safest next check.',
      steps: nextActions,
      tools,
      parts,
      time: toText(issue.time) || toText(rawResponse?.time) || 'Varies by inspection',
      difficulty,
      tips: uniqueStrings(issue.tips || rawResponse?.tips, 6),
      stopWhen: toText(issue.stopWhen) || whenToStopDIY.join(' '),
      safety: toText(issue.safety) || safetyWarnings[0] || '',
      pro: toText(issue.pro) || whenToCallProfessional.join(' ')
    },
    category: toText(rawResponse?.category) || payload.category || 'Other'
  };

  if (!normalized.safeChecks.length) {
    normalized.safeChecks = ['Turn off power/water/fuel as appropriate before inspecting accessible areas.'];
  }
  if (!normalized.nextActions.length) {
    normalized.nextActions = normalized.needsFollowUp
      ? ['Answer the follow-up questions to narrow the diagnosis safely.']
      : ['Start with the listed safe checks before attempting repairs.'];
  }
  if (!normalized.whenToCallProfessional.length) {
    normalized.whenToCallProfessional = ['Call a licensed professional if the issue requires internal electrical, gas, refrigerant, or structural work.'];
  }

  return normalized;
}

export async function generateDiagnosisFromProvider(payload, env = {}, fetchImpl = fetch) {
  const apiKey = toText(env.AI_PROVIDER_API_KEY || env.OPENAI_API_KEY);
  assert(apiKey, 503, 'AI provider credentials are not configured on the backend.');

  const apiBaseUrl = toText(env.AI_PROVIDER_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = toText(env.AI_PROVIDER_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini');

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(payload) }
        ]
      })
    });
  } catch (error) {
    const err = new Error('Provider request failed (network error)');
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`Provider request failed (${response.status})`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJsonFromModelText(content);
  return normalizeProviderDiagnosis(parsed, payload);
}

export function createBackendErrorResponse(error) {
  return {
    status: error?.status || 500,
    body: {
      error: 'diagnosis_backend_error',
      message: toText(error?.message) || 'Diagnosis backend error.'
    }
  };
}

export { ALLOWED_SCOPE, SUPPORTED_HOME_CATEGORIES };
