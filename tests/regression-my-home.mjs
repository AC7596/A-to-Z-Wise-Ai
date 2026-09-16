import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STARTER_REMINDERS,
  addEquipment,
  addEquipmentMaintenanceTask,
  addEquipmentServiceHistory,
  addMaintenanceRecord,
  addUpcomingMaintenance,
  createDefaultMyHomeProfile,
  exportMyHomeProfile,
  getMaintenanceTaskStatus,
  getWarrantyStatus,
  importMyHomeProfile,
  loadMyHomeProfile,
  markEquipmentMaintenanceTaskCompleted,
  normalizeMyHomeProfile,
  removeEquipment,
  removeEquipmentMaintenanceTask,
  removeEquipmentServiceHistory,
  removeMaintenanceRecord,
  removeUpcomingMaintenance,
  updateEquipment,
  updateHomeInfo,
  updateUpcomingMaintenance
} from '../js/modules/my-home-store.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function stripDynamicFields(profile) {
  return JSON.parse(JSON.stringify(profile, (key, value) => {
    if (key === 'id' || key === 'updatedAt' || key === 'exportedAt') return undefined;
    return value;
  }));
}

test('My Home profile regression checks', async t => {
  await t.test('default profile seeds starter reminders and property metadata', () => {
    const profile = createDefaultMyHomeProfile();
    assert.equal(profile.appId, 'a-to-z-wise-ai-my-home');
    assert.equal(profile.recordType, 'property-record');
    assert.equal(profile.propertyId, 'local-property-record');
    assert.equal(profile.version, 2);
    assert.deepEqual(Object.keys(profile.homeInfo), [
      'nickname',
      'address',
      'yearBuilt',
      'homeType',
      'squareFootage',
      'bedrooms',
      'bathrooms'
    ]);
    assert.equal(profile.equipment.length, 0);
    assert.equal(profile.maintenanceRecords.length, 0);
    assert.equal(profile.upcomingMaintenance.length, STARTER_REMINDERS.length);
    assert.equal(profile.upcomingMaintenance[0].intervalBasis, 'general');
  });

  await t.test('equipment records can be created, edited, deleted, and persist through storage', () => {
    const storage = createMemoryStorage();

    let profile = updateHomeInfo({
      nickname: 'Maple House',
      address: '123 Main Street'
    }, storage);

    profile = addEquipment({
      type: 'Furnace',
      manufacturer: 'Carrier',
      modelNumber: '58STA',
      serialNumber: 'ABC123',
      installationDate: '2021-09-01',
      manufactureDate: '2021-05-15',
      approximateAge: 'About 4 years old',
      location: 'Basement utility room',
      installer: 'ABC Heating & Cooling',
      partsInformation: '16x25x1 filter',
      notes: 'Two-stage gas furnace',
      warranty: {
        startDate: '2021-09-01',
        expirationDate: '2031-09-01',
        provider: 'Carrier',
        number: 'WAR-100'
      },
      documents: {
        ownerManual: { name: 'Carrier owner manual', url: 'https://example.com/owner-manual' },
        installationManual: { name: 'Carrier install manual', url: 'https://example.com/install-manual' },
        warrantyDocument: { name: 'Carrier warranty PDF', url: 'https://example.com/warranty' },
        receipt: { name: 'Install invoice', url: 'https://example.com/invoice' },
        modelSpecificNotes: 'Filter access is behind lower panel.'
      }
    }, storage);

    const equipmentId = profile.equipment[0].id;
    profile = updateEquipment(equipmentId, {
      approximateAge: 'Installed 2021; about 4 years old',
      location: 'Finished basement utility room',
      warranty: {
        provider: 'Carrier Extended Care',
        notes: 'Registration confirmed by homeowner.'
      },
      documents: {
        ownerManual: { name: 'Updated owner manual' }
      }
    }, storage);

    let reloaded = loadMyHomeProfile(storage);
    assert.equal(reloaded.homeInfo.nickname, 'Maple House');
    assert.equal(reloaded.equipment.length, 1);
    assert.equal(reloaded.equipment[0].location, 'Finished basement utility room');
    assert.equal(reloaded.equipment[0].warranty.provider, 'Carrier Extended Care');
    assert.equal(reloaded.equipment[0].documents.ownerManual.name, 'Updated owner manual');
    assert.equal(reloaded.equipment[0].documents.ownerManual.url, 'https://example.com/owner-manual');
    assert.equal(reloaded.equipment[0].documents.receipt.name, 'Install invoice');
    assert.equal(getWarrantyStatus(reloaded.equipment[0].warranty, '2026-09-16'), 'Active');
    assert.match(reloaded.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    profile = removeEquipment(equipmentId, storage);
    reloaded = loadMyHomeProfile(storage);
    assert.equal(profile.equipment.length, 0);
    assert.equal(reloaded.equipment.length, 0);
  });

  await t.test('equipment service history, maintenance schedules, and property reminders persist with safe statuses', () => {
    const storage = createMemoryStorage();

    let profile = addEquipment({
      type: 'Water heater',
      manufacturer: 'AO Smith',
      modelNumber: 'GCRL-40',
      warranty: { expirationDate: '2024-01-01' }
    }, storage);

    const equipmentId = profile.equipment[0].id;
    profile = addEquipmentServiceHistory(equipmentId, {
      date: '2026-08-15',
      servicePerformed: 'Flushed tank and checked anode rod',
      partsReplaced: 'Drain hose washer',
      performedBy: 'DIY',
      cost: '$18',
      notes: 'Sediment was moderate.'
    }, storage);

    profile = addEquipmentMaintenanceTask(equipmentId, {
      task: 'Flush tank',
      recommendedInterval: 'Once a year',
      intervalBasis: 'general',
      lastCompletedDate: '2026-08-15',
      nextDueDate: '2026-08-15',
      notes: 'General guidance unless manual says otherwise.'
    }, storage);

    const equipmentTaskId = profile.equipment[0].maintenanceTasks[0].id;
    profile = markEquipmentMaintenanceTaskCompleted(equipmentId, equipmentTaskId, '2026-08-15', storage);

    profile = addMaintenanceRecord({
      equipment: 'Electrical panel',
      servicePerformed: 'Tightened neutral bar and labeled breakers',
      date: '2026-07-04',
      performedBy: 'Licensed electrician',
      cost: '$145'
    }, storage);

    profile = addUpcomingMaintenance({
      task: 'Test sump pump',
      target: 'Sump pump',
      recommendedInterval: 'Before wet seasons',
      intervalBasis: 'general',
      nextDueDate: '2026-09-16',
      notes: 'Pour a bucket of water into the pit.'
    }, storage);

    const reminderId = profile.upcomingMaintenance.find(item => item.task === 'Test sump pump').id;
    profile = updateUpcomingMaintenance(reminderId, {
      completed: false,
      nextDueDate: '2026-09-16'
    }, storage);

    const reloaded = loadMyHomeProfile(storage);
    const equipment = reloaded.equipment[0];
    assert.equal(equipment.serviceHistory.length, 1);
    assert.equal(equipment.serviceHistory[0].performedBy, 'DIY');
    assert.equal(equipment.maintenanceTasks.length, 1);
    assert.equal(getMaintenanceTaskStatus(equipment.maintenanceTasks[0], '2026-09-16'), 'Completed');
    assert.equal(equipment.maintenanceTasks[0].nextDueDate, '');
    assert.equal(getMaintenanceTaskStatus(reloaded.upcomingMaintenance.find(item => item.id === reminderId), '2026-09-16'), 'Due');
    assert.equal(getWarrantyStatus(equipment.warranty, '2026-09-16'), 'Expired');
    assert.equal(getWarrantyStatus({}, '2026-09-16'), 'Unknown');
    assert.equal(reloaded.maintenanceRecords.length, 1);
  });

  await t.test('export and import round-trip the property record and reject malformed backups', () => {
    const storage = createMemoryStorage();
    let profile = updateHomeInfo({ nickname: 'Lake House', address: '45 Cedar Point' }, storage);
    profile = addEquipment({
      type: 'Dishwasher',
      manufacturer: 'Bosch',
      modelNumber: 'SHXM4AY55N',
      documents: {
        ownerManual: { name: 'Bosch use and care', url: 'https://example.com/bosch-manual' }
      }
    }, storage);
    profile = addUpcomingMaintenance({
      task: 'Clean dishwasher filter',
      target: 'Dishwasher',
      recommendedInterval: 'Every month',
      nextDueDate: '2026-10-01'
    }, storage);

    const backupJson = exportMyHomeProfile(storage);
    const backup = JSON.parse(backupJson);
    assert.equal(backup.appId, 'a-to-z-wise-ai-my-home');
    assert.equal(backup.recordType, 'property-record');
    assert.equal(backup.homeInfo.nickname, 'Lake House');
    assert.match(backup.exportedAt, /^\d{4}-\d{2}-\d{2}T/);

    const importedStorage = createMemoryStorage();
    const imported = importMyHomeProfile(backupJson, importedStorage);
    assert.equal(imported.ok, true);
    assert.deepEqual(
      stripDynamicFields(loadMyHomeProfile(importedStorage)),
      stripDynamicFields(profile)
    );

    const preservedStorage = createMemoryStorage();
    updateHomeInfo({ nickname: 'Keep me' }, preservedStorage);
    const badJson = importMyHomeProfile('not json at all', preservedStorage);
    assert.equal(badJson.ok, false);
    assert.equal(loadMyHomeProfile(preservedStorage).homeInfo.nickname, 'Keep me');

    const wrongShape = importMyHomeProfile('{"foo":"bar"}', preservedStorage);
    assert.equal(wrongShape.ok, false);
    assert.equal(loadMyHomeProfile(preservedStorage).homeInfo.nickname, 'Keep me');
  });

  await t.test('normalization preserves legacy fields, sanitizes invalid URLs, and restores starter reminders when needed', () => {
    const normalized = normalizeMyHomeProfile({
      version: 1,
      homeInfo: { nickname: 'Lake House', bathrooms: '2' },
      equipment: [
        {
          id: 'good-equipment',
          type: 'Furnace',
          manufacturer: 'Trane',
          installationDateOrAge: 'Installed 2021',
          warrantyExpiration: '2030-01-01',
          ownerManualUrl: 'javascript:alert(1)'
        },
        { id: 'bad-equipment', type: '   ', manufacturer: 'Unknown' }
      ],
      maintenanceRecords: [
        { id: 'good-record', equipment: 'Furnace', servicePerformed: 'Tune-up', date: '2026-07-01', partsUsed: 'Filter' },
        { id: 'bad-record', equipment: 'Dryer', servicePerformed: '   ' }
      ],
      upcomingMaintenance: [
        { id: 'good-reminder', task: 'Gutter cleaning', target: 'Gutters', dueDate: '2026-10-01' },
        { id: 'bad-reminder', task: '   ', target: 'Roof' }
      ]
    });

    assert.equal(normalized.homeInfo.nickname, 'Lake House');
    assert.equal(normalized.homeInfo.bathrooms, '2');
    assert.equal(normalized.equipment.length, 1);
    assert.equal(normalized.equipment[0].approximateAge, 'Installed 2021');
    assert.equal(normalized.equipment[0].warranty.expirationDate, '2030-01-01');
    assert.equal(normalized.equipment[0].documents.ownerManual.url, '');
    assert.equal(normalized.maintenanceRecords.length, 1);
    assert.equal(normalized.maintenanceRecords[0].partsReplaced, 'Filter');
    assert.equal(normalized.upcomingMaintenance.length, 1);
    assert.equal(normalized.upcomingMaintenance[0].nextDueDate, '2026-10-01');

    const starterFallback = normalizeMyHomeProfile({ upcomingMaintenance: [] });
    assert.equal(starterFallback.upcomingMaintenance.length, STARTER_REMINDERS.length);

    const invalidReminderFallback = normalizeMyHomeProfile({
      upcomingMaintenance: [{ id: 'bad-reminder', task: '   ', target: 'Roof' }]
    });
    assert.equal(invalidReminderFallback.upcomingMaintenance.length, STARTER_REMINDERS.length);
  });

  await t.test('remove operations delete nested and property-wide records without leaving invalid state', () => {
    const storage = createMemoryStorage();

    let profile = addEquipment({ type: 'Dryer', manufacturer: 'LG' }, storage);
    const equipmentId = profile.equipment[0].id;
    profile = addEquipmentServiceHistory(equipmentId, {
      date: '2026-08-20',
      servicePerformed: 'Replaced thermal fuse'
    }, storage);
    const historyId = profile.equipment[0].serviceHistory[0].id;

    profile = addEquipmentMaintenanceTask(equipmentId, {
      task: 'Clean lint duct',
      nextDueDate: '2026-09-01'
    }, storage);
    const taskId = profile.equipment[0].maintenanceTasks[0].id;

    profile = addMaintenanceRecord({
      equipment: 'Laundry area',
      servicePerformed: 'Installed overflow pan',
      date: '2026-08-01'
    }, storage);
    const recordId = profile.maintenanceRecords[0].id;

    const reminderId = profile.upcomingMaintenance[0].id;
    profile = removeEquipmentServiceHistory(equipmentId, historyId, storage);
    profile = removeEquipmentMaintenanceTask(equipmentId, taskId, storage);
    profile = removeMaintenanceRecord(recordId, storage);
    profile = removeUpcomingMaintenance(reminderId, storage);

    assert.equal(profile.equipment[0].serviceHistory.length, 0);
    assert.equal(profile.equipment[0].maintenanceTasks.length, 0);
    assert.equal(profile.maintenanceRecords.length, 0);
    assert.equal(profile.upcomingMaintenance.some(item => item.id === reminderId), false);

    const afterMiss = updateUpcomingMaintenance('missing-reminder', { nextDueDate: '2026-12-01' }, storage);
    assert.deepEqual(afterMiss, profile);

    const afterBlankTask = updateUpcomingMaintenance(
      profile.upcomingMaintenance[0].id,
      { task: '   ' },
      storage
    );
    assert.deepEqual(afterBlankTask, profile);
  });

  await t.test('homepage and navigation expose the expanded My Home property record', () => {
    const repoRoot = process.cwd();
    const homepage = fs.readFileSync(path.resolve(repoRoot, 'index.html'), 'utf8');
    assert.ok(homepage.includes('href="#my-home"'), 'homepage nav should link to My Home');
    assert.ok(homepage.includes('id="my-home"'), 'homepage should contain the My Home section');
    assert.ok(homepage.includes('Build your home&#39;s detailed digital record.') || homepage.includes("Build your home's detailed digital record."));
    assert.ok(homepage.includes('Download My Home JSON backup'));
    assert.ok(homepage.includes('there is no account, server document upload, or permanent cloud storage yet'));
    assert.ok(homepage.includes('lawful URLs only'));

    for (const page of ['privacy.html', 'terms.html', 'safety.html', 'contact.html', 'success.html']) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      assert.ok(content.includes('index.html#my-home'), `${page} should link to My Home from the header`);
    }
  });
});
