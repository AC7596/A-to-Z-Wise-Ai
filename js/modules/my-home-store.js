const STORAGE_KEY = 'fixwiseMyHomeProfile';
const CURRENT_VERSION = 1;

export const STARTER_REMINDERS = [
  { task: 'HVAC filter replacement', target: 'Air conditioner / HVAC' },
  { task: 'Furnace/HVAC inspection', target: 'Furnace / HVAC' },
  { task: 'Gutter cleaning', target: 'Exterior / gutters' },
  { task: 'Roof/shingle inspection', target: 'Roof' },
  { task: 'Water heater maintenance', target: 'Water heater' },
  { task: 'Smoke/CO detector checks', target: 'Safety devices' },
  { task: 'Exterior/siding inspection', target: 'Exterior / siding' }
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toStringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

export function createEmptyHomeInfo() {
  return {
    nickname: '',
    address: '',
    yearBuilt: '',
    homeType: '',
    squareFootage: '',
    bedrooms: '',
    bathrooms: ''
  };
}

export function createReminderTemplate(task, target = '') {
  return {
    id: createId('reminder'),
    task: toStringValue(task),
    target: toStringValue(target),
    dueDate: '',
    notes: ''
  };
}

function normalizeEquipmentEntry(entry) {
  return {
    id: toStringValue(entry?.id) || createId('equipment'),
    type: toStringValue(entry?.type),
    manufacturer: toStringValue(entry?.manufacturer),
    modelNumber: toStringValue(entry?.modelNumber),
    serialNumber: toStringValue(entry?.serialNumber),
    installationDateOrAge: toStringValue(entry?.installationDateOrAge),
    warrantyExpiration: toStringValue(entry?.warrantyExpiration),
    notes: toStringValue(entry?.notes)
  };
}

function normalizeMaintenanceEntry(entry) {
  return {
    id: toStringValue(entry?.id) || createId('maintenance'),
    equipment: toStringValue(entry?.equipment),
    servicePerformed: toStringValue(entry?.servicePerformed),
    date: toStringValue(entry?.date),
    notes: toStringValue(entry?.notes),
    partsUsed: toStringValue(entry?.partsUsed)
  };
}

function normalizeReminderEntry(entry) {
  return {
    id: toStringValue(entry?.id) || createId('reminder'),
    task: toStringValue(entry?.task),
    target: toStringValue(entry?.target),
    dueDate: toStringValue(entry?.dueDate),
    notes: toStringValue(entry?.notes)
  };
}

function createStarterReminders() {
  return STARTER_REMINDERS.map(({ task, target }) => createReminderTemplate(task, target));
}

export function createDefaultMyHomeProfile() {
  return {
    version: CURRENT_VERSION,
    updatedAt: '',
    homeInfo: createEmptyHomeInfo(),
    equipment: [],
    maintenanceRecords: [],
    upcomingMaintenance: createStarterReminders()
  };
}

export function normalizeMyHomeProfile(rawProfile) {
  const base = createDefaultMyHomeProfile();
  const profile = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};

  return {
    version: CURRENT_VERSION,
    updatedAt: toStringValue(profile.updatedAt),
    homeInfo: {
      ...base.homeInfo,
      nickname: toStringValue(profile.homeInfo?.nickname),
      address: toStringValue(profile.homeInfo?.address),
      yearBuilt: toStringValue(profile.homeInfo?.yearBuilt),
      homeType: toStringValue(profile.homeInfo?.homeType),
      squareFootage: toStringValue(profile.homeInfo?.squareFootage),
      bedrooms: toStringValue(profile.homeInfo?.bedrooms),
      bathrooms: toStringValue(profile.homeInfo?.bathrooms)
    },
    equipment: Array.isArray(profile.equipment)
      ? profile.equipment.map(normalizeEquipmentEntry).filter(item => item.type)
      : [],
    maintenanceRecords: Array.isArray(profile.maintenanceRecords)
      ? profile.maintenanceRecords.map(normalizeMaintenanceEntry).filter(item => item.equipment && item.servicePerformed)
      : [],
    upcomingMaintenance: Array.isArray(profile.upcomingMaintenance) && profile.upcomingMaintenance.length
      ? profile.upcomingMaintenance.map(normalizeReminderEntry).filter(item => item.task)
      : base.upcomingMaintenance
  };
}

export function loadMyHomeProfile(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return createDefaultMyHomeProfile();

  try {
    const raw = targetStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultMyHomeProfile();
    return normalizeMyHomeProfile(JSON.parse(raw));
  } catch (err) {
    return createDefaultMyHomeProfile();
  }
}

export function saveMyHomeProfile(profile, storage) {
  const targetStorage = getStorage(storage);
  const normalized = {
    ...normalizeMyHomeProfile(profile),
    updatedAt: nowIso()
  };

  if (targetStorage) {
    try {
      targetStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      return normalized;
    }
  }

  return normalized;
}

export function updateHomeInfo(homeInfoPatch, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    homeInfo: {
      ...profile.homeInfo,
      ...homeInfoPatch
    }
  }, storage);
}

export function addEquipment(entry, storage) {
  const profile = loadMyHomeProfile(storage);
  const normalizedEntry = normalizeEquipmentEntry(entry);
  if (!normalizedEntry.type) return profile;
  return saveMyHomeProfile({
    ...profile,
    equipment: [...profile.equipment, normalizedEntry]
  }, storage);
}

export function removeEquipment(equipmentId, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    equipment: profile.equipment.filter(item => item.id !== equipmentId)
  }, storage);
}

export function addMaintenanceRecord(entry, storage) {
  const profile = loadMyHomeProfile(storage);
  const normalizedEntry = normalizeMaintenanceEntry(entry);
  if (!normalizedEntry.equipment || !normalizedEntry.servicePerformed) return profile;
  return saveMyHomeProfile({
    ...profile,
    maintenanceRecords: [...profile.maintenanceRecords, normalizedEntry]
  }, storage);
}

export function removeMaintenanceRecord(recordId, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    maintenanceRecords: profile.maintenanceRecords.filter(item => item.id !== recordId)
  }, storage);
}

export function addUpcomingMaintenance(entry, storage) {
  const profile = loadMyHomeProfile(storage);
  const normalizedEntry = normalizeReminderEntry(entry);
  if (!normalizedEntry.task) return profile;
  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: [...profile.upcomingMaintenance, normalizedEntry]
  }, storage);
}

export function updateUpcomingMaintenance(reminderId, patch, storage) {
  const profile = loadMyHomeProfile(storage);
  if (!profile.upcomingMaintenance.some(item => item.id === reminderId)) {
    return profile;
  }
  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: profile.upcomingMaintenance.map(item => {
      if (item.id !== reminderId) return item;
      return normalizeReminderEntry({ ...item, ...patch, id: reminderId });
    })
  }, storage);
}

export function removeUpcomingMaintenance(reminderId, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: profile.upcomingMaintenance.filter(item => item.id !== reminderId)
  }, storage);
}
