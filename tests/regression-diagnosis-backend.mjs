import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DIAGNOSIS_REQUEST_VERSION,
  DIAGNOSIS_SCOPE,
  buildDiagnosisRequest,
  buildDiagnosisTransportPayload,
  normalizeDiagnosisResponse
} from '../js/api/diagnosis-contract.js';
import { diagnoseProblem } from '../js/api/ai-client.js';
import { getEquipmentDiagnosisContext } from '../js/modules/my-home-store.js';

const originalWindow = global.window;
const originalDocument = global.document;
const originalFetch = global.fetch;

function createProfile() {
  return {
    version: 1,
    updatedAt: '2026-09-16T00:00:00.000Z',
    homeInfo: {
      nickname: 'Maple House',
      address: '123 Main Street',
      yearBuilt: '1998',
      homeType: 'Single-family house',
      squareFootage: '',
      bedrooms: '',
      bathrooms: ''
    },
    equipment: [
      {
        id: 'dryer-1',
        type: 'Dryer',
        manufacturer: 'Whirlpool',
        modelNumber: 'WED4815EW',
        serialNumber: 'SER12345',
        installationDateOrAge: 'Installed 2022',
        warrantyExpiration: '2027-04-01',
        notes: 'Laundry closet'
      }
    ],
    maintenanceRecords: [
      {
        id: 'maintenance-1',
        equipment: 'Dryer — Whirlpool · WED4815EW',
        servicePerformed: 'Annual vent cleaning',
        date: '2026-08-01',
        partsUsed: 'Vent clamp',
        notes: 'Routine maintenance'
      },
      {
        id: 'maintenance-2',
        equipment: 'Dryer',
        servicePerformed: 'Replaced thermal fuse',
        date: '2025-12-15',
        partsUsed: 'Thermal fuse',
        notes: 'Fixed no-heat issue'
      }
    ],
    upcomingMaintenance: []
  };
}

function withBackendConfig(backendUrl) {
  global.window = { FIXWISE_CONFIG: { backendUrl } };
  global.document = { querySelector: () => null };
}

test('Diagnosis backend-ready contract and fallback regression checks', async (t) => {
  await t.after(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
  });

  await t.test('request builder carries structured fields and My Home context', () => {
    const profile = createProfile();
    const homeContext = getEquipmentDiagnosisContext(profile, 'dryer-1');
    const request = buildDiagnosisRequest({
      category: 'Appliance',
      problem: 'It runs but does not heat.',
      heard: 'Light hum',
      leakDetails: 'No leaks',
      errorCode: 'F31',
      intermittentBehavior: 'Only fails on heavy loads',
      problemStart: 'Started last week',
      useMyHomeContext: true,
      selectedHomeEquipmentId: 'dryer-1',
      myHomeProfile: profile,
      selectedHomeEquipment: homeContext.selectedEquipment,
      selectedHomeEquipmentHistory: homeContext,
      photos: [],
      conversationHistory: [{ answer: 'It is electric.', timestamp: '2026-09-16T00:00:00.000Z' }]
    });

    assert.equal(request.version, '2026-09-home-diy-v1');
    assert.equal(request.scope, 'home-diy-only');
    assert.equal(request.areaOrEquipment, 'Dryer');
    assert.equal(request.make, 'Whirlpool');
    assert.equal(request.model, 'WED4815EW');
    assert.equal(request.useMyHomeContext, true);
    assert.equal(request.myHomeContext.selectedEquipment.serialNumber, 'SER12345');
    assert.equal(request.myHomeContext.maintenanceHistory.length, 2);
    assert.equal(request.myHomeContext.previousRepairs.length, 1);
    assert.equal('address' in request.myHomeContext.homeSummary, false);
    assert.match(request.symptomSummary, /main problem/i);
  });

  await t.test('backend documentation stays aligned with exported contract constants', () => {
    const backendDoc = fs.readFileSync(path.resolve(process.cwd(), 'BACKEND.md'), 'utf8');
    assert.ok(backendDoc.includes(`"version": "${DIAGNOSIS_REQUEST_VERSION}"`));
    assert.ok(backendDoc.includes(`"scope": "${DIAGNOSIS_SCOPE}"`));
  });

  await t.test('transport payload requests backend-safe home-only outputs', () => {
    const profile = createProfile();
    const homeContext = getEquipmentDiagnosisContext(profile, 'dryer-1');
    const request = buildDiagnosisRequest({
      category: 'Appliance',
      areaOrEquipment: 'Dryer',
      problem: 'It will not start.',
      useMyHomeContext: true,
      selectedHomeEquipmentId: 'dryer-1',
      myHomeProfile: profile,
      selectedHomeEquipment: homeContext.selectedEquipment,
      selectedHomeEquipmentHistory: homeContext,
      photos: []
    });
    const { payload, formData } = buildDiagnosisTransportPayload(request);

    assert.equal(payload.scope, 'home-diy-only');
    assert.equal(payload.disclaimers.requireVerifiedManufacturerClaims, true);
    assert.equal(payload.requestedOutputs.whenToStopDIY, true);
    assert.equal(payload.attachmentSummary.photoCount, 0);
    assert.equal(JSON.parse(formData.get('request')).equipment.make, 'Whirlpool');
  });

  await t.test('response normalization preserves structured causes and context', () => {
    const normalized = normalizeDiagnosisResponse({
      matched: true,
      category: 'Appliance',
      possibleCauses: [{ title: 'Restricted vent', whyPossible: 'Long dry times and rising heat fit a vent restriction.' }],
      otherPossibleCauses: [{ title: 'Thermal fuse issue', whyPossible: 'Past overheating can blow the fuse.' }],
      safeChecks: ['Check the exterior vent flap for blockage.'],
      nextActions: ['Turn off power to the dryer.', 'Inspect the vent hose for kinks.'],
      safetyWarnings: ['Stop if you smell burning.'],
      whenToStopDIY: ['Stop if wiring looks damaged.'],
      whenToCallProfessional: ['Call an appliance technician if electrical testing is required.'],
      followUpQuestions: ['Is the drum turning normally?'],
      issue: {
        difficulty: 'beginner',
        time: '20–45 minutes',
        nextCheck: 'Inspect the vent path',
        tools: ['Flashlight'],
        parts: ['Vent clamp'],
        tips: ['Clean lint from the full vent path.'],
        safety: 'Disconnect power first'
      }
    }, {
      category: 'Appliance',
      areaOrEquipment: 'Dryer',
      problem: 'Dryer takes two cycles to dry clothes.',
      photos: [],
      make: 'Whirlpool',
      model: 'WED4815EW',
      useMyHomeContext: true,
      myHomeContext: {
        selectedEquipment: { type: 'Dryer', manufacturer: 'Whirlpool', modelNumber: 'WED4815EW' },
        maintenanceHistory: [{ servicePerformed: 'Vent cleaning' }],
        previousRepairs: [{ servicePerformed: 'Fuse replacement' }]
      },
      symptomSummary: 'the main problem: Dryer takes two cycles to dry clothes.'
    }, {
      sourceMode: 'live',
      backendUrl: 'https://backend.example',
      message: 'Connected to the secure diagnosis backend at https://backend.example.'
    });

    assert.equal(normalized.issue.causes[0], 'Restricted vent');
    assert.equal(normalized.possibleCauses[0].whyPossible, 'Long dry times and rising heat fit a vent restriction.');
    assert.equal(normalized.backendStatus.mode, 'live');
    assert.ok(normalized.requestContext.includedDataSources.includes('Homeowner description'));
    assert.ok(normalized.requestContext.includedDataSources.includes('My Home equipment record'));
    assert.ok(normalized.requestContext.includedDataSources.includes('Secure backend AI service'));
  });

  await t.test('live backend calls use the structured contract without exposing secrets', async () => {
    withBackendConfig('https://backend.example');
    global.fetch = async (url, options) => {
      const payload = JSON.parse(options.body.get('request'));
      assert.equal(url, 'https://backend.example/api/diagnose');
      assert.equal(options.method, 'POST');
      assert.equal(payload.scope, 'home-diy-only');
      assert.equal(payload.disclaimers.requireVerifiedManufacturerClaims, true);
      return {
        ok: true,
        async json() {
          return {
            matched: true,
            possibleCauses: [{ title: 'Dirty filter', whyPossible: 'The airflow symptoms point to a filter restriction.' }],
            safeChecks: ['Check the accessible filter first.'],
            nextActions: ['Turn off power before opening the panel.'],
            whenToStopDIY: ['Stop if you smell burning.'],
            whenToCallProfessional: ['Call a licensed HVAC professional for sealed-system work.'],
            issue: {
              difficulty: 'beginner',
              time: '10–15 minutes',
              nextCheck: 'Inspect the filter',
              tools: ['None required'],
              parts: ['Replacement filter'],
              tips: ['Confirm the airflow arrow direction.'],
              safety: 'Power off first'
            }
          };
        }
      };
    };

    const result = await diagnoseProblem({
      category: 'Heating & Cooling',
      areaOrEquipment: 'Air conditioner / HVAC',
      problem: 'Airflow is weak at several vents.',
      photos: [],
      conversationHistory: []
    });

    assert.equal(result.backendStatus.mode, 'live');
    assert.equal(result.backendStatus.usingFallback, false);
    assert.equal(result.issue.causes[0], 'Dirty filter');
  });

  await t.test('backend failure falls back honestly to demo mode', async () => {
    withBackendConfig('https://backend.example');
    global.fetch = async () => {
      throw new Error('backend unavailable');
    };

    const result = await diagnoseProblem({
      category: 'Appliance',
      areaOrEquipment: 'Dryer',
      problem: 'My dryer will not start.',
      photos: [],
      conversationHistory: []
    });

    assert.equal(result.backendStatus.mode, 'demo');
    assert.equal(result.backendStatus.usingFallback, true);
    assert.match(result.backendStatus.message, /fell back to Demo Mode/i);
    assert.equal(result.matched, true);
  });
});
