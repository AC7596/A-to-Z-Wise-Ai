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

test('provider array content responses are parsed correctly', async () => {
  const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());

  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    matched: true,
                    possibleCauses: ['Loose wiring connection'],
                    safeChecks: ['Turn off power before opening access panels.'],
                    nextActions: ['Inspect visible wiring for looseness.'],
                    whenToCallProfessional: ['Call a licensed electrician for live-circuit testing.'],
                    issue: { difficulty: 'professional', nextCheck: 'Inspect accessible wiring points' }
                  })
                }
              ]
            }
          }
        ]
      };
    }
  });

  const result = await generateDiagnosisFromProvider(payload, { AI_PROVIDER_API_KEY: 'test-key' }, fakeFetch);
  assert.equal(result.possibleCauses[0].title, 'Loose wiring connection');
});

test('invalid provider payload returns backend/provider error', async () => {
  const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return { choices: [{ message: { content: '{}' } }] };
    }
  });

  await assert.rejects(
    () => generateDiagnosisFromProvider(payload, { AI_PROVIDER_API_KEY: 'test-key' }, fakeFetch),
    /valid diagnosis payload/i
  );
});

  test('provider boolean diagnosis flags are preserved', () => {
    const payload = validateAndNormalizeDiagnosisPayload(createBasePayload());
    const normalized = normalizeProviderDiagnosis({
      matched: false,
      needsFollowUp: true,
      followUpQuestions: ['Is the dryer getting full voltage?'],
      safeChecks: ['Check breaker positions without opening panels.'],
      nextActions: ['Answer follow-up questions before attempting repairs.'],
      whenToCallProfessional: ['Call an appliance technician for meter-based testing.']
    }, payload);

    assert.equal(normalized.matched, false);
    assert.equal(normalized.needsFollowUp, true);
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

test('worker supports health and constrains CORS preflight routes', async () => {
  const health = await worker.fetch(new Request('https://backend.example/api/health', { method: 'GET' }), {});
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true);

  const healthWrongMethod = await worker.fetch(
    new Request('https://backend.example/api/health', { method: 'POST' }),
    {}
  );
  assert.equal(healthWrongMethod.status, 405);

  const unknownOptions = await worker.fetch(
    new Request('https://backend.example/unknown', { method: 'OPTIONS', headers: { Origin: 'https://atozwiseai.com' } }),
    { ALLOWED_ORIGINS: 'https://atozwiseai.com' }
  );
  assert.equal(unknownOptions.status, 404);

  const deniedPreflight = await worker.fetch(
    new Request('https://backend.example/api/diagnose', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }),
    { ALLOWED_ORIGINS: 'https://atozwiseai.com' }
  );
  assert.equal(deniedPreflight.status, 403);

  const allowedGithubPagesPreflight = await worker.fetch(
    new Request('https://backend.example/api/diagnose', { method: 'OPTIONS', headers: { Origin: 'https://ac7596.github.io' } }),
    { ALLOWED_ORIGINS: 'https://atozwiseai.com,https://www.atozwiseai.com,https://ac7596.github.io' }
  );
  assert.equal(allowedGithubPagesPreflight.status, 204);
});

test('worker multipart guardrails enforce request size and file-like uploads', async () => {
  const tooLargeMultipartRequest = {
    method: 'POST',
    url: 'https://backend.example/api/diagnose',
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'multipart/form-data; boundary=----demo';
        if (key === 'content-length') return String(26 * 1024 * 1024);
        return null;
      }
    },
    async formData() {
      throw new Error('should not parse oversized body');
    }
  };

  const tooLargeResponse = await worker.fetch(tooLargeMultipartRequest, {});
  assert.equal(tooLargeResponse.status, 413);

  const badPhotosMultipartRequest = {
    method: 'POST',
    url: 'https://backend.example/api/diagnose',
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'multipart/form-data; boundary=----demo';
        if (key === 'content-length') return '1024';
        return null;
      }
    },
    async formData() {
      return {
        get(field) {
          if (field !== 'request') return null;
          return JSON.stringify(createBasePayload());
        },
        getAll(field) {
          if (field !== 'photos') return [];
          return ['not-a-file'];
        }
      };
    }
  };

  const badPhotosResponse = await worker.fetch(badPhotosMultipartRequest, {});
  assert.equal(badPhotosResponse.status, 400);
});
