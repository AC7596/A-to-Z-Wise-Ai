import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STARTER_REMINDERS,
  addEquipment,
  addMaintenanceRecord,
  addUpcomingMaintenance,
  createDefaultMyHomeProfile,
  loadMyHomeProfile,
  removeEquipment,
  removeMaintenanceRecord,
  removeUpcomingMaintenance,
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

test('My Home profile regression checks', async (t) => {
  await t.test('default profile seeds starter reminders and empty home info', () => {
    const profile = createDefaultMyHomeProfile();
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
  });

  await t.test('profile data persists through storage-backed updates', () => {
    const storage = createMemoryStorage();

    let profile = updateHomeInfo({
      nickname: 'Maple House',
      address: '123 Main Street',
      yearBuilt: '1998',
      homeType: 'Single-family house'
    }, storage);

    profile = addEquipment({
      type: 'Furnace',
      manufacturer: 'Carrier',
      modelNumber: '58STA',
      serialNumber: 'ABC123',
      installationDateOrAge: 'Installed 2021',
      warrantyExpiration: '2031-09-01',
      notes: 'Basement utility room'
    }, storage);

    profile = addMaintenanceRecord({
      equipment: 'Furnace — Carrier · 58STA',
      servicePerformed: 'Annual inspection',
      date: '2026-09-01',
      partsUsed: 'Filter',
      notes: 'No issues found'
    }, storage);

    const customReminder = profile.upcomingMaintenance[0];
    profile = updateUpcomingMaintenance(customReminder.id, {
      dueDate: '2026-10-01',
      notes: 'Replace before winter'
    }, storage);

    profile = addUpcomingMaintenance({
      task: 'Dryer vent cleaning',
      target: 'Dryer',
      dueDate: '2026-11-01',
      notes: 'Schedule before holidays'
    }, storage);

    const reloaded = loadMyHomeProfile(storage);
    assert.equal(reloaded.homeInfo.nickname, 'Maple House');
    assert.equal(reloaded.homeInfo.address, '123 Main Street');
    assert.equal(reloaded.equipment.length, 1);
    assert.equal(reloaded.equipment[0].type, 'Furnace');
    assert.equal(reloaded.maintenanceRecords.length, 1);
    assert.equal(reloaded.maintenanceRecords[0].servicePerformed, 'Annual inspection');
    assert.equal(reloaded.upcomingMaintenance.some(item => item.task === 'Dryer vent cleaning'), true);
    assert.equal(reloaded.upcomingMaintenance.some(item => item.notes === 'Replace before winter'), true);
    assert.match(reloaded.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  await t.test('remove operations delete saved items and missing reminder updates stay unchanged', () => {
    const storage = createMemoryStorage();

    let profile = addEquipment({ type: 'Water heater', manufacturer: 'AO Smith' }, storage);
    const equipmentId = profile.equipment[0].id;

    profile = addMaintenanceRecord({
      equipment: 'Water heater',
      servicePerformed: 'Flushed tank',
      date: '2026-08-15'
    }, storage);
    const recordId = profile.maintenanceRecords[0].id;

    const reminderId = profile.upcomingMaintenance[0].id;
    const unchangedUpdatedAt = profile.updatedAt;

    profile = removeEquipment(equipmentId, storage);
    profile = removeMaintenanceRecord(recordId, storage);
    profile = removeUpcomingMaintenance(reminderId, storage);

    assert.equal(profile.equipment.length, 0);
    assert.equal(profile.maintenanceRecords.length, 0);
    assert.equal(profile.upcomingMaintenance.some(item => item.id === reminderId), false);

    const afterMiss = updateUpcomingMaintenance('missing-reminder', { dueDate: '2026-12-01' }, storage);
    assert.equal(afterMiss.updatedAt, profile.updatedAt);
    assert.notEqual(afterMiss.updatedAt, unchangedUpdatedAt);
  });

  await t.test('homepage and navigation expose the My Home experience', () => {
    const repoRoot = process.cwd();
    const homepage = fs.readFileSync(path.resolve(repoRoot, 'index.html'), 'utf8');
    assert.ok(homepage.includes('href="#my-home"'), 'homepage nav should link to My Home');
    assert.ok(homepage.includes('id="my-home"'), 'homepage should contain the My Home section');
    assert.ok(homepage.includes('Start your home&#39;s digital record.') || homepage.includes("Start your home's digital record."));
    assert.ok(homepage.includes('there is no account, cloud backup, or permanent online storage yet'));

    for (const page of ['privacy.html', 'terms.html', 'safety.html', 'contact.html', 'success.html']) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      assert.ok(content.includes('index.html#my-home'), `${page} should link to My Home from the header`);
    }
  });
});
