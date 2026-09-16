export const DIAGNOSIS_SCOPE = 'home-diy-only';
export const DIAGNOSIS_REQUEST_VERSION = '2026-09-home-diy-v1';

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map(toTrimmedString).filter(Boolean)));
}

function normalizeConversationHistory(entries) {
  return Array.isArray(entries)
    ? entries
      .map(entry => ({
        answer: toTrimmedString(entry?.answer),
        timestamp: toTrimmedString(entry?.timestamp) || new Date().toISOString()
      }))
      .filter(entry => entry.answer)
    : [];
}

function normalizePhotoList(photos) {
  return Array.isArray(photos) ? photos.filter(Boolean) : [];
}

function compactRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const cleaned = Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== '' && value !== null && value !== undefined;
    })
  );
  return Object.keys(cleaned).length ? cleaned : null;
}

function normalizePossibleCause(entry, symptomSummary, isPrimary) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return {
      title: entry,
      whyPossible: symptomSummary
        ? `${isPrimary ? 'Listed first because' : 'Possible because'} you reported ${symptomSummary}.`
        : 'Possible based on the symptom pattern you described.'
    };
  }
  const title = toTrimmedString(entry.title || entry.name || entry.cause);
  if (!title) return null;
  return {
    title,
    whyPossible: toTrimmedString(entry.whyPossible)
      || (symptomSummary
        ? `${isPrimary ? 'Listed first because' : 'Possible because'} you reported ${symptomSummary}.`
        : 'Possible based on the symptom pattern you described.')
  };
}

function normalizeList(values) {
  return Array.isArray(values)
    ? uniqueStrings(values)
    : [];
}

function summarizeSymptoms(request) {
  const labels = [
    ['the main problem', request.problem],
    ['the area or equipment involved', request.areaOrEquipment],
    ['what you can see', request.seen],
    ['sounds/noises', request.heard],
    ['unusual smells', request.smell],
    ['leaks or moisture', request.leakDetails],
    ['error codes or indicator lights', request.errorCode],
    ['intermittent behavior', request.intermittentBehavior],
    ['when it started', request.problemStart],
    ['other symptoms', request.otherSymptoms]
  ].filter(([, value]) => value);

  if (!labels.length) return '';
  if (labels.length === 1) return `${labels[0][0]}: ${labels[0][1]}`;
  return labels.slice(0, 3).map(([label, value]) => `${label}: ${value}`).join('; ');
}

function extractIssue(raw = {}) {
  const issue = raw.issue && typeof raw.issue === 'object' ? { ...raw.issue } : {};
  const primaryCauses = Array.isArray(raw.possibleCauses) && raw.possibleCauses.length
    ? raw.possibleCauses
    : (Array.isArray(issue.possibleCauses) ? issue.possibleCauses : issue.causes);
  const otherCauses = Array.isArray(raw.otherPossibleCauses) && raw.otherPossibleCauses.length
    ? raw.otherPossibleCauses
    : (Array.isArray(issue.otherPossibleCauses) ? issue.otherPossibleCauses : issue.otherCauses);
  const followUpQuestions = Array.isArray(raw.followUpQuestions) && raw.followUpQuestions.length
    ? raw.followUpQuestions
    : (Array.isArray(issue.followUpQuestions) ? issue.followUpQuestions : issue.clarifyingQuestions);

  return {
    ...issue,
    causes: normalizeList(issue.causes),
    otherCauses: normalizeList(issue.otherCauses),
    clarifyingQuestions: normalizeList(issue.clarifyingQuestions),
    steps: normalizeList(issue.steps),
    safeChecks: normalizeList(raw.safeChecks || issue.safeChecks),
    nextActions: normalizeList(raw.nextActions || issue.nextActions || issue.steps),
    tools: normalizeList(raw.tools || issue.tools),
    parts: normalizeList(raw.parts || issue.parts),
    tips: normalizeList(raw.tips || issue.tips),
    safetyWarnings: normalizeList(raw.safetyWarnings || issue.safetyWarnings),
    stopWhenList: normalizeList(raw.whenToStopDIY || issue.whenToStopDIY),
    professionalWhenList: normalizeList(raw.whenToCallProfessional || issue.whenToCallProfessional),
    possibleCauses: Array.isArray(primaryCauses) ? primaryCauses : [],
    otherPossibleCauses: Array.isArray(otherCauses) ? otherCauses : [],
    followUpQuestions: Array.isArray(followUpQuestions) ? followUpQuestions : []
  };
}

export function buildDiagnosisRequest(rawRequest = {}) {
  const profile = rawRequest.myHomeProfile && typeof rawRequest.myHomeProfile === 'object'
    ? rawRequest.myHomeProfile
    : null;
  const selectedEquipment = rawRequest.selectedHomeEquipment && typeof rawRequest.selectedHomeEquipment === 'object'
    ? rawRequest.selectedHomeEquipment
    : null;
  const selectedEquipmentHistory = rawRequest.selectedHomeEquipmentHistory && typeof rawRequest.selectedHomeEquipmentHistory === 'object'
    ? rawRequest.selectedHomeEquipmentHistory
    : null;

  const request = {
    version: DIAGNOSIS_REQUEST_VERSION,
    scope: DIAGNOSIS_SCOPE,
    category: toTrimmedString(rawRequest.category),
    areaOrEquipment: toTrimmedString(rawRequest.areaOrEquipment),
    problem: toTrimmedString(rawRequest.problem),
    seen: toTrimmedString(rawRequest.seen),
    heard: toTrimmedString(rawRequest.heard),
    smell: toTrimmedString(rawRequest.smell),
    leakDetails: toTrimmedString(rawRequest.leakDetails),
    errorCode: toTrimmedString(rawRequest.errorCode),
    intermittentBehavior: toTrimmedString(rawRequest.intermittentBehavior),
    problemStart: toTrimmedString(rawRequest.problemStart),
    otherSymptoms: toTrimmedString(rawRequest.otherSymptoms),
    make: toTrimmedString(rawRequest.make),
    model: toTrimmedString(rawRequest.model),
    conversationHistory: normalizeConversationHistory(rawRequest.conversationHistory),
    photos: normalizePhotoList(rawRequest.photos),
    useMyHomeContext: Boolean(rawRequest.useMyHomeContext && selectedEquipment),
    selectedHomeEquipmentId: toTrimmedString(rawRequest.selectedHomeEquipmentId),
    myHomeContext: null,
    symptomSummary: ''
  };

  if (request.useMyHomeContext && selectedEquipment) {
    if (!request.areaOrEquipment) request.areaOrEquipment = toTrimmedString(selectedEquipment.type);
    if (!request.make) request.make = toTrimmedString(selectedEquipment.manufacturer);
    if (!request.model) request.model = toTrimmedString(selectedEquipment.modelNumber);
  }

  request.symptomSummary = summarizeSymptoms(request);

  if (request.useMyHomeContext && selectedEquipment) {
    request.myHomeContext = compactRecord({
      profileUpdatedAt: toTrimmedString(profile?.updatedAt),
      selectedEquipment: compactRecord({
        id: toTrimmedString(selectedEquipment.id),
        type: toTrimmedString(selectedEquipment.type),
        manufacturer: toTrimmedString(selectedEquipment.manufacturer),
        modelNumber: toTrimmedString(selectedEquipment.modelNumber),
        serialNumber: toTrimmedString(selectedEquipment.serialNumber),
        installationDateOrAge: toTrimmedString(selectedEquipment.installationDateOrAge),
        warrantyExpiration: toTrimmedString(selectedEquipment.warrantyExpiration),
        warrantyDetails: toTrimmedString(selectedEquipment.warrantyDetails),
        notes: toTrimmedString(selectedEquipment.notes)
      }),
      maintenanceHistory: (selectedEquipmentHistory?.maintenanceHistory || []).map(item => compactRecord({
        recordType: toTrimmedString(item.recordType),
        servicePerformed: toTrimmedString(item.servicePerformed),
        date: toTrimmedString(item.date),
        partsUsed: toTrimmedString(item.partsUsed),
        notes: toTrimmedString(item.notes)
      })).filter(Boolean),
      previousRepairs: (selectedEquipmentHistory?.previousRepairs || []).map(item => compactRecord({
        recordType: toTrimmedString(item.recordType),
        servicePerformed: toTrimmedString(item.servicePerformed),
        date: toTrimmedString(item.date),
        partsUsed: toTrimmedString(item.partsUsed),
        notes: toTrimmedString(item.notes)
      })).filter(Boolean),
      homeSummary: compactRecord({
        nickname: toTrimmedString(profile?.homeInfo?.nickname),
        yearBuilt: toTrimmedString(profile?.homeInfo?.yearBuilt),
        homeType: toTrimmedString(profile?.homeInfo?.homeType)
      })
    });
  }

  return request;
}

export function buildDiagnosisTransportPayload(request) {
  const payload = {
    version: request.version,
    scope: request.scope,
    category: request.category,
    areaOrEquipment: request.areaOrEquipment,
    equipment: compactRecord({
      make: request.make,
      model: request.model
    }),
    problem: request.problem,
    symptoms: compactRecord({
      seen: request.seen,
      heard: request.heard,
      smell: request.smell,
      leakDetails: request.leakDetails,
      errorCode: request.errorCode,
      intermittentBehavior: request.intermittentBehavior,
      problemStart: request.problemStart,
      otherSymptoms: request.otherSymptoms
    }),
    conversationHistory: request.conversationHistory,
    useMyHomeContext: request.useMyHomeContext,
    myHomeContext: request.myHomeContext,
    requestedOutputs: {
      possibleCauses: true,
      causeExplanations: true,
      safeChecks: true,
      tools: true,
      parts: true,
      nextActions: true,
      safetyWarnings: true,
      whenToStopDIY: true,
      whenToCallProfessional: true,
      followUpQuestions: true
    },
    disclaimers: {
      scope: DIAGNOSIS_SCOPE,
      requireVerifiedManufacturerClaims: true,
      neverClaimCertainty: true
    },
    attachmentSummary: {
      photoCount: request.photos.length
    }
  };

  const formData = new FormData();
  formData.append('request', JSON.stringify(payload));
  request.photos.forEach(photo => formData.append('photos', photo));
  return { payload, formData };
}

export function normalizeDiagnosisResponse(rawResponse = {}, request = {}, meta = {}) {
  const issue = extractIssue(rawResponse);
  const symptomSummary = request.symptomSummary || summarizeSymptoms(request);
  const photoCount = Array.isArray(request.photos) ? request.photos.length : 0;
  const inferredMatched = typeof rawResponse.matched === 'boolean'
    ? rawResponse.matched
    : Boolean(rawResponse.needsFollowUp || issue.possibleCauses.length || issue.otherPossibleCauses.length || issue.nextActions?.length);

  const possibleCauses = issue.possibleCauses
    .map((entry, index) => normalizePossibleCause(entry, symptomSummary, index === 0))
    .filter(Boolean);
  const otherPossibleCauses = issue.otherPossibleCauses
    .map(entry => normalizePossibleCause(entry, symptomSummary, false))
    .filter(Boolean);
  const followUpQuestions = uniqueStrings(issue.followUpQuestions.length ? issue.followUpQuestions : issue.clarifyingQuestions);
  const safeChecks = uniqueStrings(issue.safeChecks.length ? issue.safeChecks : [issue.nextCheck]);
  const nextActions = uniqueStrings(issue.nextActions.length ? issue.nextActions : issue.steps);
  const safetyWarnings = uniqueStrings(issue.safetyWarnings.length ? issue.safetyWarnings : [rawResponse.dangerConfig?.message, issue.safety]);
  const whenToStopDIY = uniqueStrings(issue.stopWhenList.length ? issue.stopWhenList : [issue.stopWhen]);
  const whenToCallProfessional = uniqueStrings(issue.professionalWhenList.length ? issue.professionalWhenList : [issue.pro]);
  const includedDataSources = uniqueStrings([
    request.problem || request.areaOrEquipment || request.seen || request.heard || request.smell
    || request.leakDetails || request.errorCode || request.intermittentBehavior
    || request.problemStart || request.otherSymptoms ? 'Homeowner description' : '',
    photoCount ? 'Attached photos' : '',
    request.useMyHomeContext && request.myHomeContext?.selectedEquipment ? 'My Home equipment record' : '',
    request.useMyHomeContext && request.myHomeContext?.maintenanceHistory?.length ? 'My Home maintenance history' : '',
    request.useMyHomeContext && request.myHomeContext?.previousRepairs?.length ? 'My Home previous repairs' : '',
    meta.sourceMode === 'live' ? 'Secure backend AI service' : 'Demo diagnosis knowledge base'
  ]);

  return {
    ...rawResponse,
    matched: inferredMatched,
    category: rawResponse.category || request.category || '',
    issue: {
      ...issue,
      causes: possibleCauses.map(item => item.title),
      otherCauses: otherPossibleCauses.map(item => item.title),
      clarifyingQuestions: followUpQuestions,
      safeChecks,
      steps: nextActions,
      tools: issue.tools,
      parts: issue.parts,
      tips: issue.tips,
      stopWhen: whenToStopDIY.join(' '),
      pro: whenToCallProfessional.join(' '),
      safety: issue.safety || safetyWarnings[0] || ''
    },
    possibleCauses,
    otherPossibleCauses,
    safeChecks,
    nextActions,
    followUpQuestions,
    safetyWarnings,
    whenToStopDIY,
    whenToCallProfessional,
    backendStatus: {
      mode: meta.sourceMode || 'demo',
      usingFallback: Boolean(meta.usingFallback),
      message: meta.message || '',
      backendUrl: meta.backendUrl || ''
    },
    requestContext: compactRecord({
      scope: request.scope || DIAGNOSIS_SCOPE,
      symptomSummary,
      areaOrEquipment: request.areaOrEquipment,
      make: request.make,
      model: request.model,
      useMyHomeContext: request.useMyHomeContext,
      selectedEquipment: request.myHomeContext?.selectedEquipment || null,
      maintenanceHistoryCount: request.myHomeContext?.maintenanceHistory?.length || 0,
      previousRepairsCount: request.myHomeContext?.previousRepairs?.length || 0,
      includedDataSources
    })
  };
}
