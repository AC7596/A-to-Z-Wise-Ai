import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../backend/worker.mjs';
import {
  validateAndNormalizeDiagnosisPayload,
  detectImmediateSafetyStop,
  buildSafetyStopResponse,
  generateDiagnosisFromProvider,
  normalizeProviderDiagnosis
} from '../backend/diagnosis-service.mjs';

function createBasePayload() {
  return {
    version: '2026-09-home-diy-v1',
    scope: 'home-diy-only',
    category: 'Appliance',
    areaOrEquipment: 'Dryer',
    equipment: { make: 'Whirlpool', model: 'WED4815EW' },
    problem: 'Dryer runs but does not heat.',
    symptoms: {
      heard: 'light humming',
      errorCode: 'F31',
      intermittentBehavior: 'Worse on heavy loads'
    },
    conversationHistory: [{ answer: 'It is electric.', timestamp: '2026-09-16T00:00:00.000Z' }],
    useMyHomeContext: true,
    myHomeContext: {
      selectedEquipment: {
        id: 'dryer-1',
        type: 'Dryer',
        manufacturer: 'Whirlpool',
        modelNumber: 'WED4815EW',
        installationDateOrAge: 'Installed 2022'
      },
      maintenanceHistory: [
        { recordType: 'maintenance', servicePerformed: 'Vent cleaning', date: '2026-08-01' }
      ],
      previousRepairs: [
        { recordType: 'repair', servicePerformed: 'Thermal fuse replacement', date: '2025-12-01' }
      ]
    }
  };
}

test('secure backend payload validation preserves home/DIY contract', () => {
  const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());
  assert.equal(payload.scope, 'home-diy-only');
  assert.equal(payload.problem, 'Dryer runs but does not heat.');
  assert.equal(payload.myHomeContext.selectedEquipment.modelNumber, 'WED4815EW');
  assert.equal(payload.myHomeContext.maintenanceHistory.length, 1);
});

test('secure backend rejects unsupported diagnosis scope', () => {
  assert.throws(() => {
    validateAndNormalizeDiagnosisPayload({ ...createBasePayload(), scope: 'automotive' });
  }, /home-diy-only/i);
});

test('immediate safety guardrail returns STOP guidance for danger signals', () => {
  const payload = validateAndNormalizeDiagnosisPayload({
    ...createBasePayload(),
    category: 'Electrical',
    problem: 'I smell gas and see sparking near the furnace.'
  });

  const danger = detectImmediateSafetyStop(payload);
  assert.ok(danger);
  const response = buildSafetyStopResponse(payload, danger);
  assert.equal(response.isEmergency, true);
  assert.equal(response.hasDanger, true);
  assert.match(response.dangerConfig.message, /stop/i);
  assert.ok(response.whenToCallProfessional.length > 0);
});

test('provider output is normalized into UI-ready structured diagnosis fields', () => {
  const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());
  const normalized = normalizeProviderDiagnosis({
    matched: true,
    possibleCauses: ['Restricted vent'],
    safeChecks: ['Check vent flap'],
    nextActions: ['Turn off power', 'Inspect vent hose'],
    whenToCallProfessional: ['Call a technician if internal testing is required'],
    followUpQuestions: ['Does the drum spin normally?'],
    issue: {
      difficulty: 'beginner',
      time: '20-45 minutes',
      nextCheck: 'Inspect full vent path'
    }
  }, payload);

  assert.equal(normalized.possibleCauses[0].title, 'Restricted vent');
  assert.equal(normalized.issue.causes[0], 'Restricted vent');
  assert.equal(normalized.issue.difficulty, 'beginner');
  assert.ok(normalized.safeChecks.length > 0);
});

test('provider call uses server-side secret and returns normalized response', async () => {
  const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());

  const fakeFetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization.startsWith('Bearer '), true);

    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  matched: true,
                  possibleCauses: [{ title: 'Clogged vent', whyPossible: 'Long dry times often indicate restricted airflow.' }],
                  safeChecks: ['Inspect exterior vent flap.'],
                  nextActions: ['Power off dryer before inspection.'],
                  whenToCallProfessional: ['Call a licensed appliance technician for electrical testing.'],
                  issue: { difficulty: 'beginner', time: '15-30 minutes', nextCheck: 'Check vent airflow' }
                })
              }
            }
          ]
        };
      }
    };
  };

  const result = await generateDiagnosisFromProvider(payload, { AI_PROVIDER_API_KEY: 'test-key' }, fakeFetch);
  assert.equal(result.matched, true);
  assert.equal(result.possibleCauses[0].title, 'Clogged vent');
  assert.equal(result.issue.difficulty, 'beginner');
});

test('worker endpoint serves diagnosis and enforces backend configuration', async () => {
  const body = JSON.stringify(createBasePayload());

  const successRequest = new Request('https://backend.example/api/diagnose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  });

  const successResponse = await worker.fetch(successRequest, {
    AI_PROVIDER_API_KEY: 'test-key',
    AI_PROVIDER_BASE_URL: 'https://provider.example/v1',
    AI_PROVIDER_MODEL: 'gpt-4o-mini'
  });

  assert.equal(successResponse.status, 502);

  const missingSecretRequest = new Request('https://backend.example/api/diagnose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  });

  const missingSecretResponse = await worker.fetch(missingSecretRequest, {});
  assert.equal(missingSecretResponse.status, 503);
  const json = await missingSecretResponse.json();
  assert.match(json.message, /not configured/i);
});
