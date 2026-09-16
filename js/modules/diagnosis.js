// ========================================
// AI DIAGNOSIS: form handling + results rendering
// ========================================
import { diagnoseProblem, analyzePhotos, isBackendConnected } from '../api/ai-client.js';
import { getSelectedPhotos, clearPhotos } from './photo-upload.js';
import { getLevelBySlug } from '../data/levels.js';
import { escapeHtml } from '../utils/html.js';
import { repairGuides } from '../data/guides-data.js';
import { openRepairMode } from './repair-mode.js';
import { buildEquipmentLabel, getEquipmentDiagnosisContext, loadMyHomeProfile } from './my-home-store.js';

const els = {};

// In-browser session state for the current diagnosis conversation. This is
// intentionally simple client-side state (not a real chat backend): it lets
// follow-up answers build on the original description and on each other,
// instead of every submission being treated as an unrelated new problem.
// It is persisted to sessionStorage so the conversation survives a reload
// within the same browser tab/session (cleared on "Reset" or tab close).
const SESSION_KEY = 'fixwiseDiagnosisSession';
let session = createEmptySession();

function createEmptySession() {
  return {
    category: '', areaOrEquipment: '', problem: '', seen: '', heard: '', smell: '', leakDetails: '',
    errorCode: '', intermittentBehavior: '', problemStart: '', otherSymptoms: '', make: '', model: '',
    useMyHomeContext: false, selectedHomeEquipmentId: '',
    conversationHistory: [], // [{ answer: string, timestamp: string }]
    lastDiagnosis: null
  };
}

function saveSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    // sessionStorage may be unavailable (e.g. privacy mode) — conversation
    // still works in-memory for the current page view.
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return { ...createEmptySession(), ...JSON.parse(raw) };
  } catch (err) {
    // Ignore malformed/unavailable storage and start a fresh session.
  }
  return createEmptySession();
}

function clearSession() {
  session = createEmptySession();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (err) {
    // Ignore — nothing persisted to clear.
  }
}

function cacheEls() {
  const ids = [
    'diagnosisForm', 'category', 'problem', 'seen', 'heard', 'smell', 'otherSymptoms',
    'areaOrEquipment', 'equipmentMake', 'equipmentModel', 'leakDetails', 'errorCode',
    'intermittentBehavior', 'problemStart', 'useMyHomeContext', 'myHomeEquipmentSelect', 'myHomeContextHint',
    'resultCard', 'resultTitle', 'resultText', 'resultState', 'modeBadge', 'confidenceBadge',
    'backendStatusText', 'requestContextSection', 'requestContextSummary', 'requestContextList',
    'dangerWarning', 'warningTitle', 'warningText', 'warningAction', 'warningBadge', 'intentText',
    'mostLikelyCauses', 'mostLikelyList',
    'otherCausesSection', 'otherCausesList',
    'clarifyingSection', 'clarifyingList',
    'safeChecksSection', 'safeChecksList',
    'followUpSection', 'followUpAnswer', 'submitFollowUp', 'conversationLog',
    'stepsSection', 'stepsList',
    'toolsSection', 'toolsList',
    'partsSection', 'partsList',
    'tipsSection', 'tipsList',
    'stopSection', 'stopText',
    'nextCheck', 'diyLevel', 'safetyLevel', 'estimatedTime',
    'professionalNote', 'professionalText',
    'relatedGuideSection', 'guideMeThroughIt',
    'photoNote', 'analyzeBtn', 'formError'
  ];
  ids.forEach(id => { els[id] = document.getElementById(id); });
}

function setListOrHide(sectionEl, listEl, items) {
  if (!sectionEl || !listEl) return;
  if (!items || items.length === 0) {
    sectionEl.style.display = 'none';
    return;
  }
  sectionEl.style.display = 'block';
  listEl.innerHTML = items.map(item => {
    if (typeof item === 'string') return `<li>${escapeHtml(item)}</li>`;
    const title = escapeHtml(item.title || item.name || '');
    const whyPossible = escapeHtml(item.whyPossible || '');
    if (!title) return '';
    return `<li><strong>${title}</strong>${whyPossible ? `<span class="cause-why">${whyPossible}</span>` : ''}</li>`;
  }).join('');
}

function resetResultSections() {
  ['dangerWarning', 'mostLikelyCauses', 'otherCausesSection', 'clarifyingSection',
    'safeChecksSection', 'requestContextSection', 'followUpSection', 'stepsSection', 'toolsSection',
    'partsSection', 'tipsSection', 'stopSection', 'professionalNote', 'relatedGuideSection', 'photoNote',
    'intentText', 'backendStatusText'].forEach(key => {
    if (els[key]) els[key].style.display = 'none';
  });
  if (els.dangerWarning) els.dangerWarning.className = 'danger-warning';
  if (els.guideMeThroughIt) delete els.guideMeThroughIt.dataset.guideId;
  if (els.confidenceBadge) {
    els.confidenceBadge.textContent = '';
    els.confidenceBadge.className = 'confidence-badge';
  }
  if (els.backendStatusText) {
    els.backendStatusText.textContent = '';
    els.backendStatusText.className = 'backend-status-note';
  }
}

function renderModeBadge(diagnosis = null) {
  if (!els.modeBadge) return;
  const mode = diagnosis?.backendStatus?.mode;
  const usingFallback = Boolean(diagnosis?.backendStatus?.usingFallback);
  const connected = isBackendConnected();
  if (mode === 'live' && !usingFallback) {
    els.modeBadge.textContent = 'Backend connected';
    els.modeBadge.className = 'mode-badge mode-live';
    return;
  }
  if (connected && usingFallback) {
    els.modeBadge.textContent = 'Demo fallback';
    els.modeBadge.className = 'mode-badge mode-demo';
    return;
  }
  els.modeBadge.textContent = connected ? 'Backend ready' : 'Demo Mode';
  els.modeBadge.className = 'mode-badge' + (connected ? ' mode-live' : ' mode-demo');
}

function renderConversationLog() {
  if (!els.conversationLog) return;
  els.conversationLog.textContent = '';
  session.conversationHistory.forEach(entry => {
    const li = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = 'You added: ';
    li.appendChild(label);
    li.appendChild(document.createTextNode(entry.answer));
    els.conversationLog.appendChild(li);
  });
}

function showEmptyState(message) {
  resetResultSections();
  els.resultTitle.textContent = 'Tell me what you\'re seeing';
  els.resultText.textContent = message;
  els.nextCheck.textContent = 'Add symptoms';
  els.diyLevel.textContent = '—';
  els.safetyLevel.textContent = '—';
  els.estimatedTime.textContent = '—';
}

function showLoadingState() {
  resetResultSections();
  renderModeBadge();
  els.resultTitle.textContent = 'Analyzing…';
  els.resultText.textContent = isBackendConnected()
    ? 'Sending your description to the A to Z Wise AI diagnosis service…'
    : 'Reviewing your description with the A to Z Wise AI demo diagnosis engine…';
  els.resultCard.classList.add('is-loading');
}

function renderLevelBadge(el, slug) {
  const level = getLevelBySlug(slug);
  if (!el) return;
  el.textContent = level ? level.label : '—';
  el.className = 'result-badge' + (level ? ` ${level.className}` : '');
}

function renderIntentLine(diagnosis) {
  if (!els.intentText) return;
  if (!diagnosis.intentMeta) {
    els.intentText.style.display = 'none';
    return;
  }
  els.intentText.style.display = 'block';
  els.intentText.innerHTML = `<strong>What A to Z Wise AI understands:</strong> Based on what you've described, ${escapeHtml(diagnosis.intentMeta.understanding)}.`;
}

function renderDangerWarning(diagnosis) {
  if (!diagnosis.hasDanger || !diagnosis.dangerConfig) {
    els.dangerWarning.style.display = 'none';
    return;
  }
  const level = diagnosis.dangerConfig.level || diagnosis.riskLevel || 'high';
  els.dangerWarning.style.display = 'flex';
  els.dangerWarning.className = `danger-warning risk-${level}`;
  els.warningTitle.textContent = level === 'stop' ? 'STOP — Safety Alert' : (level === 'caution' ? 'Use Caution' : 'Safety Alert');
  els.warningText.textContent = diagnosis.dangerConfig.message;
  if (els.warningAction) {
    els.warningAction.textContent = diagnosis.dangerConfig.action || '';
    els.warningAction.style.display = diagnosis.dangerConfig.action ? 'block' : 'none';
  }
  els.warningBadge.textContent = diagnosis.dangerConfig.badge;
}

function renderBackendStatus(diagnosis) {
  if (!els.backendStatusText) return;
  const message = diagnosis?.backendStatus?.message;
  if (!message) {
    els.backendStatusText.style.display = 'none';
    return;
  }
  els.backendStatusText.style.display = 'block';
  els.backendStatusText.textContent = message;
  els.backendStatusText.className = 'backend-status-note' + (diagnosis?.backendStatus?.usingFallback ? ' is-warning' : '');
}

function renderRequestContext(diagnosis) {
  if (!els.requestContextSection || !els.requestContextSummary || !els.requestContextList) return;
  const context = diagnosis?.requestContext;
  const includedDataSources = context?.includedDataSources || [];
  if (!context || !includedDataSources.length) {
    els.requestContextSection.style.display = 'none';
    return;
  }

  const contextLines = [];
  if (context.areaOrEquipment) contextLines.push(`Area/equipment: ${context.areaOrEquipment}`);
  if (context.make || context.model) contextLines.push(`Make/model: ${[context.make, context.model].filter(Boolean).join(' · ')}`);
  if (context.selectedEquipment) {
    contextLines.push(`My Home record: ${buildEquipmentLabel(context.selectedEquipment)}`);
  }
  if (context.maintenanceHistoryCount) contextLines.push(`Maintenance entries included: ${context.maintenanceHistoryCount}`);
  if (context.previousRepairsCount) contextLines.push(`Repair-history entries included: ${context.previousRepairsCount}`);

  els.requestContextSection.style.display = 'block';
  els.requestContextSummary.textContent = context.symptomSummary
    ? `Summary: ${context.symptomSummary}`
    : 'This diagnosis uses the information listed below.';
  els.requestContextList.innerHTML = [
    ...includedDataSources.map(item => `Used: ${item}`),
    ...contextLines
  ].map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function buildMyHomeHint(profile, context) {
  if (!profile.equipment.length) {
    return 'Add equipment in My Home above if you want to reuse manufacturer, model, age, warranty, notes, and service history here.';
  }
  if (!context?.selectedEquipment) {
    return 'Choose a saved system or appliance to include its manufacturer, model, serial, age, warranty, notes, maintenance history, and repair history in this diagnosis request.';
  }
  const item = context.selectedEquipment;
  const historyCount = context.maintenanceHistory.length;
  const repairCount = context.previousRepairs.length;
  return [
    `Ready to include: ${buildEquipmentLabel(item)}.`,
    item.serialNumber ? 'Stored serial number will stay browser-side until a secure backend is connected.' : '',
    historyCount ? `${historyCount} maintenance entr${historyCount === 1 ? 'y' : 'ies'} available.` : 'No maintenance history matched yet.',
    repairCount ? `${repairCount} prior repair entr${repairCount === 1 ? 'y' : 'ies'} available.` : ''
  ].filter(Boolean).join(' ');
}

function renderResults(diagnosis, photoResult) {
  els.resultCard.classList.remove('is-loading');
  resetResultSections();
  renderModeBadge(diagnosis);
  renderBackendStatus(diagnosis);
  renderRequestContext(diagnosis);

  if (!diagnosis || !diagnosis.matched) {
    els.resultTitle.textContent = 'No specific match yet';
    els.resultText.textContent = 'I didn\'t find a strong match. Try adding more detail about what you see, hear, smell, or notice — specific words like "dripping," "spark," "gurgling," or "won\'t heat" help narrow it down.';
    els.nextCheck.textContent = 'Add more details';
    els.diyLevel.textContent = '—';
    els.safetyLevel.textContent = '—';
    els.estimatedTime.textContent = '—';
    return;
  }

  renderDangerWarning(diagnosis);
  renderIntentLine(diagnosis);

  const { issue, category } = diagnosis;

  // ---- Emergency: show the stop warning as the whole story ----
  if (diagnosis.isEmergency) {
    els.resultTitle.textContent = 'This may need immediate attention';
    els.resultText.textContent = 'Based on what you\'ve described, this looks like a safety hazard rather than a routine repair question. Please follow the safety alert above before doing anything else.';
    els.nextCheck.textContent = 'Follow the safety alert above';
    els.diyLevel.textContent = 'Do not DIY';
    els.diyLevel.className = 'result-badge level-emergency';
    els.safetyLevel.textContent = 'Stop immediately';
    els.estimatedTime.textContent = 'N/A';
    return;
  }

  // ---- Needs follow-up: not enough info to give a specific recommendation,
  // so ask rather than guess (see intent-data.js) ----
  if (diagnosis.needsFollowUp) {
    els.resultTitle.textContent = `Let's narrow this down`;
    els.resultText.textContent = `Based on what you've described, A to Z Wise AI doesn't have enough detail yet to give a specific, useful recommendation. One of the questions below can help — add an answer in the box below and A to Z Wise AI will refine its response.`;
    setListOrHide(els.clarifyingSection, els.clarifyingList, diagnosis.followUpQuestions?.length ? diagnosis.followUpQuestions : diagnosis.clarifyingQuestions);
    if (els.followUpSection) {
      els.followUpSection.style.display = 'block';
      renderConversationLog();
    }
    els.nextCheck.textContent = 'Answer a question below';
    els.diyLevel.textContent = '—';
    els.safetyLevel.textContent = diagnosis.hasDanger ? 'See safety alert' : 'Depends on your answer';
    els.estimatedTime.textContent = '—';
    return;
  }

  // ---- Matched but no specific knowledge-base entry ----
  if (!issue) {
    els.resultTitle.textContent = 'No specific match yet';
    els.resultText.textContent = 'I didn\'t find a strong match. Try adding more detail about what you see, hear, smell, or notice.';
    els.nextCheck.textContent = 'Add more details';
    els.diyLevel.textContent = '—';
    els.safetyLevel.textContent = '—';
    els.estimatedTime.textContent = '—';
    return;
  }

  const introVerb = diagnosis.intent === 'repair' ? 'repair' : (diagnosis.intent === 'replace' ? 'replacement' : 'issue');
  els.resultTitle.textContent = `${category} ${introVerb === 'issue' ? 'diagnosis' : introVerb} guidance`;
  els.resultText.textContent = `Based on what you've described, here is A to Z Wise AI's informational guidance for this ${category.toLowerCase()} ${introVerb}. One possible cause is listed first below — this is not a guaranteed diagnosis, so use it as a starting point.`;

  setListOrHide(els.mostLikelyCauses, els.mostLikelyList, issue.causes);
  if (diagnosis.possibleCauses?.length) {
    setListOrHide(els.mostLikelyCauses, els.mostLikelyList, diagnosis.possibleCauses);
  }
  if (diagnosis.confidence && els.confidenceBadge) {
    els.confidenceBadge.textContent = diagnosis.confidence.label;
    els.confidenceBadge.className = `confidence-badge confidence-${diagnosis.confidence.level}`;
  }
  setListOrHide(els.otherCausesSection, els.otherCausesList, diagnosis.otherPossibleCauses?.length ? diagnosis.otherPossibleCauses : issue.otherCauses);
  setListOrHide(els.clarifyingSection, els.clarifyingList, diagnosis.followUpQuestions?.length ? diagnosis.followUpQuestions : issue.clarifyingQuestions);
  setListOrHide(els.safeChecksSection, els.safeChecksList, diagnosis.safeChecks?.length ? diagnosis.safeChecks : issue.safeChecks);
  setListOrHide(els.stepsSection, els.stepsList, diagnosis.nextActions?.length ? diagnosis.nextActions : issue.steps);
  setListOrHide(els.toolsSection, els.toolsList, issue.tools);
  setListOrHide(els.partsSection, els.partsList, issue.parts);
  setListOrHide(els.tipsSection, els.tipsList, issue.tips);

  if (els.followUpSection) {
    els.followUpSection.style.display = 'block';
    renderConversationLog();
  }

  if (issue.stopWhen || diagnosis.whenToStopDIY?.length) {
    els.stopSection.style.display = 'block';
    els.stopText.textContent = diagnosis.whenToStopDIY?.join(' ') || issue.stopWhen;
  }

  els.nextCheck.textContent = issue.nextCheck || 'Inspect the affected area';
  renderLevelBadge(els.diyLevel, issue.difficulty);
  els.safetyLevel.textContent = issue.safety || diagnosis.safetyWarnings?.[0] || 'Use caution';
  els.estimatedTime.textContent = issue.time || '—';

  if (issue.pro || diagnosis.whenToCallProfessional?.length) {
    els.professionalNote.style.display = 'block';
    els.professionalText.textContent = diagnosis.whenToCallProfessional?.join(' ') || issue.pro;
  }

  // ---- Connect diagnosis to an existing interactive repair guide, when
  // this issue has one, so the homeowner can go straight from "here's what
  // it might be" to "walk me through fixing it" without leaving the flow.
  if (diagnosis.relatedGuideId && els.relatedGuideSection && els.guideMeThroughIt) {
    const guide = repairGuides.find(g => g.id === diagnosis.relatedGuideId);
    if (guide) {
      els.relatedGuideSection.style.display = 'block';
      els.guideMeThroughIt.dataset.guideId = guide.id;
    }
  }

  if (photoResult && photoResult.note) {
    els.photoNote.style.display = 'block';
    els.photoNote.textContent = photoResult.note;
  }
}

function populateMyHomeEquipmentSelect() {
  if (!els.myHomeEquipmentSelect || !els.useMyHomeContext) return;
  const profile = loadMyHomeProfile();
  const options = profile.equipment || [];
  const hasEquipment = options.length > 0;

  els.myHomeEquipmentSelect.innerHTML = hasEquipment
    ? ['<option value="">Select saved equipment</option>']
      .concat(options.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(buildEquipmentLabel(item))}</option>`))
      .join('')
    : '<option value="">No saved My Home equipment yet</option>';

  if (session.selectedHomeEquipmentId && options.some(item => item.id === session.selectedHomeEquipmentId)) {
    els.myHomeEquipmentSelect.value = session.selectedHomeEquipmentId;
  } else if (!hasEquipment) {
    session.selectedHomeEquipmentId = '';
  }

  els.myHomeEquipmentSelect.disabled = !els.useMyHomeContext.checked || !hasEquipment;
  const context = getEquipmentDiagnosisContext(profile, els.myHomeEquipmentSelect.value);
  if (els.myHomeContextHint) {
    els.myHomeContextHint.textContent = buildMyHomeHint(profile, context);
  }
}

function syncSelectedEquipmentFields() {
  const profile = loadMyHomeProfile();
  const context = getEquipmentDiagnosisContext(profile, els.myHomeEquipmentSelect?.value);
  const item = context.selectedEquipment;
  if (!item) {
    if (els.myHomeContextHint) els.myHomeContextHint.textContent = buildMyHomeHint(profile, context);
    return;
  }

  if (!els.areaOrEquipment.value.trim()) els.areaOrEquipment.value = item.type || '';
  if (!els.equipmentMake.value.trim()) els.equipmentMake.value = item.manufacturer || '';
  if (!els.equipmentModel.value.trim()) els.equipmentModel.value = item.modelNumber || '';
  if (els.myHomeContextHint) els.myHomeContextHint.textContent = buildMyHomeHint(profile, context);
}

export function initDiagnosisForm() {
  cacheEls();
  if (!els.diagnosisForm) return;

  renderModeBadge();
  session = loadSession();

  // Restore the in-progress form + conversation from this browser session,
  // if one exists, so a page reload doesn't lose context mid-diagnosis.
  if (els.category && session.category) els.category.value = session.category;
  if (els.areaOrEquipment) els.areaOrEquipment.value = session.areaOrEquipment || '';
  if (els.problem) els.problem.value = session.problem || '';
  if (els.seen) els.seen.value = session.seen || '';
  if (els.heard) els.heard.value = session.heard || '';
  if (els.smell) els.smell.value = session.smell || '';
  if (els.leakDetails) els.leakDetails.value = session.leakDetails || '';
  if (els.errorCode) els.errorCode.value = session.errorCode || '';
  if (els.intermittentBehavior) els.intermittentBehavior.value = session.intermittentBehavior || '';
  if (els.problemStart) els.problemStart.value = session.problemStart || '';
  if (els.otherSymptoms) els.otherSymptoms.value = session.otherSymptoms || '';
  if (els.equipmentMake) els.equipmentMake.value = session.make || '';
  if (els.equipmentModel) els.equipmentModel.value = session.model || '';
  if (els.useMyHomeContext) els.useMyHomeContext.checked = Boolean(session.useMyHomeContext);
  populateMyHomeEquipmentSelect();
  if (els.myHomeEquipmentSelect && session.selectedHomeEquipmentId) {
    els.myHomeEquipmentSelect.value = session.selectedHomeEquipmentId;
  }
  if (els.useMyHomeContext?.checked) syncSelectedEquipmentFields();

  if (session.lastDiagnosis) {
    renderResults(session.lastDiagnosis, null);
  } else {
    showEmptyState('Enter a repair problem and press "Analyze problem." This demo shows how the future A to Z Wise AI diagnosis flow can respond.');
  }

  async function runDiagnosis() {
    els.analyzeBtn.disabled = true;
    els.analyzeBtn.textContent = 'Analyzing…';
    if (els.submitFollowUp) els.submitFollowUp.disabled = true;
    showLoadingState();

    try {
      const photos = getSelectedPhotos();
      const myHomeProfile = loadMyHomeProfile();
      const myHomeContext = getEquipmentDiagnosisContext(myHomeProfile, session.selectedHomeEquipmentId);
      const [diagnosis, photoResult] = await Promise.all([
        diagnoseProblem({
          category: session.category,
          areaOrEquipment: session.areaOrEquipment,
          problem: session.problem,
          seen: session.seen,
          heard: session.heard,
          smell: session.smell,
          leakDetails: session.leakDetails,
          errorCode: session.errorCode,
          intermittentBehavior: session.intermittentBehavior,
          problemStart: session.problemStart,
          otherSymptoms: session.otherSymptoms,
          make: session.make,
          model: session.model,
          useMyHomeContext: session.useMyHomeContext,
          selectedHomeEquipmentId: session.selectedHomeEquipmentId,
          myHomeProfile,
          selectedHomeEquipment: myHomeContext.selectedEquipment,
          selectedHomeEquipmentHistory: myHomeContext,
          photos,
          conversationHistory: session.conversationHistory
        }),
        analyzePhotos({ photos })
      ]);
      session.lastDiagnosis = diagnosis;
      saveSession();
      renderResults(diagnosis, photoResult);
      els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      resetResultSections();
      els.resultCard.classList.remove('is-loading');
      els.resultTitle.textContent = 'Something went wrong';
      els.resultText.textContent = 'We couldn\'t complete the analysis. Please try again in a moment.';
      els.nextCheck.textContent = '—';
      els.diyLevel.textContent = '—';
      els.safetyLevel.textContent = '—';
      els.estimatedTime.textContent = '—';
    } finally {
      els.analyzeBtn.disabled = false;
      els.analyzeBtn.textContent = 'Analyze problem';
      if (els.submitFollowUp) els.submitFollowUp.disabled = false;
    }
  }

  els.diagnosisForm.addEventListener('submit', (event) => {
    event.preventDefault();

    // A new form submission starts a fresh diagnosis session/conversation.
    session = createEmptySession();
    session.category = els.category.value;
    session.areaOrEquipment = els.areaOrEquipment.value.trim();
    session.problem = els.problem.value.trim();
    session.seen = els.seen.value.trim();
    session.heard = els.heard.value.trim();
    session.smell = els.smell.value.trim();
    session.leakDetails = els.leakDetails.value.trim();
    session.errorCode = els.errorCode.value.trim();
    session.intermittentBehavior = els.intermittentBehavior.value.trim();
    session.problemStart = els.problemStart.value.trim();
    session.otherSymptoms = els.otherSymptoms.value.trim();
    session.make = els.equipmentMake.value.trim();
    session.model = els.equipmentModel.value.trim();
    session.useMyHomeContext = Boolean(els.useMyHomeContext?.checked);
    session.selectedHomeEquipmentId = els.myHomeEquipmentSelect?.value || '';

    if (els.formError) els.formError.textContent = '';

    if (session.useMyHomeContext && !session.selectedHomeEquipmentId) {
      if (els.formError) {
        els.formError.textContent = 'Choose a saved My Home system/appliance or uncheck the My Home option before analyzing.';
      }
      return;
    }

    if (!session.problem && !session.areaOrEquipment && !session.seen && !session.heard && !session.smell && !session.leakDetails && !session.errorCode && !session.intermittentBehavior && !session.problemStart && !session.otherSymptoms) {
      if (els.formError) {
        els.formError.textContent = 'Please describe the problem in detail or add at least one symptom before analyzing.';
      }
      showEmptyState('Describe what is happening, then press "Analyze problem."');
      return;
    }

    saveSession();
    runDiagnosis();
  });

  els.submitFollowUp?.addEventListener('click', () => {
    if (els.submitFollowUp.disabled) return;
    const answer = els.followUpAnswer?.value.trim();
    if (!answer || !session.lastDiagnosis) return;

    session.conversationHistory.push({ answer, timestamp: new Date().toISOString() });
    saveSession();
    if (els.followUpAnswer) els.followUpAnswer.value = '';
    runDiagnosis();
  });

  document.getElementById('resetDiagnosis')?.addEventListener('click', () => {
    els.diagnosisForm.reset();
    clearPhotos();
    clearSession();
    populateMyHomeEquipmentSelect();
    if (els.formError) els.formError.textContent = '';
    showEmptyState('Enter a repair problem and press "Analyze problem." This demo shows how the future A to Z Wise AI diagnosis flow can respond.');
  });

  els.useMyHomeContext?.addEventListener('change', () => {
    session.useMyHomeContext = Boolean(els.useMyHomeContext.checked);
    populateMyHomeEquipmentSelect();
    if (els.useMyHomeContext.checked) syncSelectedEquipmentFields();
    saveSession();
  });

  els.myHomeEquipmentSelect?.addEventListener('change', () => {
    session.selectedHomeEquipmentId = els.myHomeEquipmentSelect.value;
    syncSelectedEquipmentFields();
    saveSession();
  });
  els.myHomeEquipmentSelect?.addEventListener('focus', populateMyHomeEquipmentSelect);

  els.guideMeThroughIt?.addEventListener('click', () => {
    const guideId = els.guideMeThroughIt.dataset.guideId;
    const guide = repairGuides.find(g => g.id === guideId);
    if (guide) openRepairMode(guide);
  });
}
