const STORAGE_KEY = 'fixwiseMyHomeProfile';
const CURRENT_VERSION = 4;
const APP_ID = 'a-to-z-wise-ai-my-home';
const RECORD_TYPE = 'property-record';
const LOCAL_PROPERTY_ID = 'local-property-record';

export const EQUIPMENT_TYPES = [
  'Furnace',
  'Air conditioner / heat pump',
  'Water heater',
  'Refrigerator',
  'Dishwasher',
  'Washer',
  'Dryer',
  'Range / oven',
  'Microwave',
  'Garbage disposal',
  'Electrical panel',
  'Sump pump',
  'Garage door opener',
  'Other home equipment'
];

export const DOCUMENT_TYPES = [
  "Owner's Manual",
  'Warranty',
  'Receipt',
  'Installation Document',
  'Service Document',
  'Parts Information',
  'Other'
];

export const STARTER_REMINDERS = [
  { task: 'HVAC filter replacement', target: 'Air conditioner / heat pump', recommendedInterval: 'Every 1-3 months', intervalBasis: 'general' },
  { task: 'Furnace or heat pump inspection', target: 'Furnace', recommendedInterval: 'Once a year', intervalBasis: 'general' },
  { task: 'Water heater maintenance', target: 'Water heater', recommendedInterval: 'Once a year', intervalBasis: 'general' },
  { task: 'Dryer vent cleaning', target: 'Dryer', recommendedInterval: 'At least once a year', intervalBasis: 'general' },
  { task: 'Smoke/CO detector checks', target: 'Safety devices', recommendedInterval: 'Once a month', intervalBasis: 'general' },
  { task: 'Gutter cleaning', target: 'Exterior / gutters', recommendedInterval: 'Twice a year', intervalBasis: 'general' },
  { task: 'Sump pump test', target: 'Sump pump', recommendedInterval: 'Before wet seasons', intervalBasis: 'general' }
];

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toStringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toBooleanValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === 'on' || normalized === '1';
  }
  return false;
}

function toUrlValue(value) {
  const url = toStringValue(value);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch (err) {
    return '';
  }
}

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toDateOnly(value) {
  const trimmed = toStringValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

function normalizeDocumentLink(entry) {
  return {
    name: toStringValue(entry?.name),
    url: toUrlValue(entry?.url)
  };
}

function normalizeDocumentType(value, fallback = 'Other') {
  const normalized = toStringValue(value);
  return DOCUMENT_TYPES.includes(normalized) ? normalized : fallback;
}

function normalizeDocumentRecord(entry, fallbackType = 'Other') {
  return {
    id: toStringValue(entry?.id) || createId('document'),
    name: toStringValue(entry?.name),
    type: normalizeDocumentType(entry?.type, fallbackType),
    url: toUrlValue(entry?.url),
    warrantyProvider: toStringValue(entry?.warrantyProvider || entry?.provider),
    warrantyNumber: toStringValue(entry?.warrantyNumber || entry?.number),
    warrantyStartDate: toDateOnly(entry?.warrantyStartDate || entry?.startDate),
    warrantyExpirationDate: toDateOnly(entry?.warrantyExpirationDate || entry?.expirationDate || entry?.warrantyExpiration),
    notes: toStringValue(entry?.notes)
  };
}

function hasDocumentRecordContent(record) {
  return !!(
    record?.name
    || record?.url
    || record?.warrantyProvider
    || record?.warrantyNumber
    || record?.warrantyStartDate
    || record?.warrantyExpirationDate
    || record?.notes
  );
}

function documentRecordSignature(record) {
  return [
    toStringValue(record?.name).toLowerCase(),
    normalizeDocumentType(record?.type),
    toUrlValue(record?.url).toLowerCase(),
    toStringValue(record?.warrantyProvider).toLowerCase(),
    toStringValue(record?.warrantyNumber).toLowerCase(),
    toDateOnly(record?.warrantyStartDate),
    toDateOnly(record?.warrantyExpirationDate),
    toStringValue(record?.notes).toLowerCase()
  ].join('|');
}

function dedupeDocumentRecords(records) {
  const seen = new Set();
  return records.filter(record => {
    if (!hasDocumentRecordContent(record)) return false;
    const signature = documentRecordSignature(record);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function normalizeWarranty(entry) {
  return {
    startDate: toDateOnly(entry?.startDate),
    expirationDate: toDateOnly(entry?.expirationDate || entry?.warrantyExpiration),
    provider: toStringValue(entry?.provider),
    number: toStringValue(entry?.number),
    notes: toStringValue(entry?.notes)
  };
}

function normalizeMaintenanceEntry(entry) {
  const parts = toStringValue(entry?.partsReplaced || entry?.partsUsed);
  const workType = toStringValue(entry?.workType || entry?.servicePerformed);
  return {
    id: toStringValue(entry?.id) || createId('maintenance'),
    equipment: toStringValue(entry?.equipment),
    workType,
    servicePerformed: workType,
    description: toStringValue(entry?.description),
    date: toDateOnly(entry?.date),
    partsReplaced: parts,
    partsUsed: parts,
    performedBy: toStringValue(entry?.performedBy),
    cost: toStringValue(entry?.cost),
    notes: toStringValue(entry?.notes)
  };
}

function normalizeTaskEntry(entry, { includeTarget = false } = {}) {
  const normalized = {
    id: toStringValue(entry?.id) || createId('reminder'),
    task: toStringValue(entry?.task),
    recommendedInterval: toStringValue(entry?.recommendedInterval),
    intervalBasis: toStringValue(entry?.intervalBasis) === 'manufacturer' ? 'manufacturer' : 'general',
    lastCompletedDate: toDateOnly(entry?.lastCompletedDate),
    nextDueDate: toDateOnly(entry?.nextDueDate || entry?.dueDate),
    notes: toStringValue(entry?.notes),
    completed: toBooleanValue(entry?.completed)
  };

  if (includeTarget) {
    normalized.target = toStringValue(entry?.target);
  }

  return normalized;
}

function normalizeEquipmentEntry(entry) {
  const installationDate = toDateOnly(entry?.installationDate);
  const legacyInstallOrAge = toStringValue(entry?.installationDateOrAge);
  const warranty = normalizeWarranty(entry?.warranty || {
    expirationDate: entry?.warrantyExpiration
  });
  const documents = {
    ownerManual: normalizeDocumentLink(entry?.documents?.ownerManual || {
      name: entry?.ownerManualName,
      url: entry?.ownerManualUrl
    }),
    installationManual: normalizeDocumentLink(entry?.documents?.installationManual || {
      name: entry?.installationManualName,
      url: entry?.installationManualUrl
    }),
    warrantyDocument: normalizeDocumentLink(entry?.documents?.warrantyDocument || {
      name: entry?.warrantyDocumentName,
      url: entry?.warrantyDocumentUrl
    }),
    receipt: normalizeDocumentLink(entry?.documents?.receipt || {
      name: entry?.receiptName,
      url: entry?.receiptUrl
    }),
    partsReference: normalizeDocumentLink(entry?.documents?.partsReference || {
      name: entry?.partsReferenceName,
      url: entry?.partsReferenceUrl || entry?.referenceUrl
    }),
    modelSpecificNotes: toStringValue(entry?.documents?.modelSpecificNotes || entry?.modelSpecificNotes)
  };
  const explicitDocumentRecords = Array.isArray(entry?.documentRecords || entry?.documentsAndWarranties)
    ? (entry.documentRecords || entry.documentsAndWarranties)
      .map(item => normalizeDocumentRecord(item, normalizeDocumentType(item?.type)))
    : [];
  const warrantyDetails = formatLegacyWarrantyDetails({
    ...warranty,
    notes: toStringValue(entry?.warrantyDetails) || warranty.notes
  });
  const installationDateOrAge = toStringValue(entry?.installationDateOrAge)
    || toStringValue(entry?.approximateAge)
    || (installationDate ? `Installed ${installationDate}` : '');

  return {
    id: toStringValue(entry?.id) || createId('equipment'),
    type: toStringValue(entry?.type),
    customName: toStringValue(entry?.customName || entry?.name),
    manufacturer: toStringValue(entry?.manufacturer),
    modelNumber: toStringValue(entry?.modelNumber),
    serialNumber: toStringValue(entry?.serialNumber),
    purchaseDate: toDateOnly(entry?.purchaseDate),
    installationDate,
    manufactureDate: toDateOnly(entry?.manufactureDate),
    approximateAge: toStringValue(entry?.approximateAge) || (!installationDate ? legacyInstallOrAge : ''),
    installationDateOrAge,
    location: toStringValue(entry?.location),
    installer: toStringValue(entry?.installer),
    notes: toStringValue(entry?.notes),
    partsInformation: toStringValue(entry?.partsInformation),
    warranty,
    warrantyExpiration: warranty.expirationDate,
    warrantyDetails,
    documents,
    documentRecords: dedupeDocumentRecords(explicitDocumentRecords),
    serviceHistory: Array.isArray(entry?.serviceHistory)
      ? entry.serviceHistory.map(normalizeMaintenanceEntry).filter(item => item.date && item.servicePerformed)
      : [],
    maintenanceTasks: Array.isArray(entry?.maintenanceTasks)
      ? entry.maintenanceTasks.map(item => normalizeTaskEntry(item)).filter(item => item.task)
      : []
  };
}

function createStarterReminders() {
  return STARTER_REMINDERS.map(item => normalizeTaskEntry(item, { includeTarget: true }));
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
  return normalizeTaskEntry({ task, target }, { includeTarget: true });
}

export function buildEquipmentLabel(item) {
  const manufacturerModel = [item?.manufacturer, item?.modelNumber].map(toStringValue).filter(Boolean).join(' · ');
  const customName = toStringValue(item?.customName);
  const type = toStringValue(item?.type);
  const primaryLabel = customName || type;
  const typeSuffix = customName && type ? ` (${type})` : '';
  if (manufacturerModel) return `${primaryLabel}${typeSuffix} — ${manufacturerModel}`;
  return `${primaryLabel}${typeSuffix}` || 'Equipment record';
}

function normalizeSearchText(value) {
  return toStringValue(value).toLowerCase();
}

function getRecordParts(record) {
  return toStringValue(record?.partsUsed || record?.partsReplaced);
}

function recordMentionsEquipment(record, equipment) {
  const haystack = normalizeSearchText([
    record?.equipment,
    record?.workType,
    record?.servicePerformed,
    record?.description,
    record?.notes,
    getRecordParts(record)
  ].filter(Boolean).join(' '));

  if (!haystack) return false;

  const exactLabels = [
    buildEquipmentLabel(equipment),
    equipment?.type,
    equipment?.manufacturer,
    equipment?.modelNumber,
    equipment?.serialNumber
  ].map(normalizeSearchText).filter(Boolean);

  return exactLabels.some(label => haystack.includes(label));
}

function isRepairLikeRecord(record) {
  const text = normalizeSearchText([
    record?.workType,
    record?.servicePerformed,
    record?.description,
    record?.notes,
    getRecordParts(record)
  ].filter(Boolean).join(' '));

  return /(repair|repaired|replace|replacement|fixed|fix|service call|diagnos|troubleshoot)/.test(text);
}

function formatLegacyInstallationDateOrAge(entry) {
  const explicit = toStringValue(entry?.installationDateOrAge);
  if (explicit) return explicit;
  if (toStringValue(entry?.approximateAge)) return toStringValue(entry?.approximateAge);
  const installationDate = toDateOnly(entry?.installationDate);
  return installationDate ? `Installed ${installationDate}` : '';
}

function formatLegacyWarrantyDetails(warranty) {
  return [
    toStringValue(warranty?.provider),
    toStringValue(warranty?.number),
    toStringValue(warranty?.notes)
  ].filter(Boolean).join(' · ');
}

function buildDiagnosisHistoryEntry(record, recordType = 'maintenance') {
  return {
    ...record,
    recordType,
    partsUsed: getRecordParts(record)
  };
}

export function getEquipmentById(profile, equipmentId) {
  if (!equipmentId) return null;
  return (profile?.equipment || []).find(item => item.id === equipmentId) || null;
}

export function getEquipmentDiagnosisContext(profile, equipmentId) {
  const normalizedProfile = normalizeMyHomeProfile(profile);
  const selectedEquipment = getEquipmentById(normalizedProfile, equipmentId);

  if (!selectedEquipment) {
    return {
      selectedEquipment: null,
      maintenanceHistory: [],
      previousRepairs: []
    };
  }

  const normalizedSelectedEquipment = {
    ...selectedEquipment,
    installationDateOrAge: formatLegacyInstallationDateOrAge(selectedEquipment),
    warrantyExpiration: selectedEquipment.warranty?.expirationDate || '',
    warrantyDetails: formatLegacyWarrantyDetails(selectedEquipment.warranty)
  };

  const exactServiceHistory = selectedEquipment.serviceHistory
    .map(record => buildDiagnosisHistoryEntry(record, 'maintenance'));
  const propertyMaintenanceHistory = normalizedProfile.maintenanceRecords
    .filter(record => recordMentionsEquipment(record, selectedEquipment))
    .map(record => buildDiagnosisHistoryEntry(record, 'maintenance'));
  const maintenanceHistory = [...exactServiceHistory, ...propertyMaintenanceHistory]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    selectedEquipment: normalizedSelectedEquipment,
    maintenanceHistory,
    previousRepairs: maintenanceHistory
      .filter(isRepairLikeRecord)
      .map(record => ({ ...record, recordType: 'repair' }))
  };
}

export function createDefaultMyHomeProfile() {
  return {
    appId: APP_ID,
    recordType: RECORD_TYPE,
    propertyId: LOCAL_PROPERTY_ID,
    version: CURRENT_VERSION,
    updatedAt: '',
    homeInfo: createEmptyHomeInfo(),
    equipment: [],
    propertyDocuments: [],
    maintenanceRecords: [],
    upcomingMaintenance: createStarterReminders()
  };
}

export function getWarrantyStatus(warranty, referenceDate = todayIso()) {
  const normalized = normalizeWarranty(warranty);
  if (!normalized.expirationDate) return 'Unknown';
  return normalized.expirationDate < referenceDate ? 'Expired' : 'Active';
}

export function getMaintenanceTaskStatus(task, referenceDate = todayIso()) {
  const normalized = normalizeTaskEntry(task);
  if (
    normalized.completed &&
    (!normalized.nextDueDate || !normalized.lastCompletedDate || normalized.nextDueDate <= normalized.lastCompletedDate)
  ) return 'Completed';
  if (!normalized.nextDueDate) return 'Upcoming';
  if (normalized.nextDueDate < referenceDate) return 'Overdue';
  if (normalized.nextDueDate === referenceDate) return 'Due';
  return 'Upcoming';
}

function hasRecognizedImportShape(profile) {
  if (!isPlainObject(profile)) return false;
  if (profile.appId === APP_ID && profile.recordType === RECORD_TYPE) return true;
  return isPlainObject(profile.homeInfo)
    && Array.isArray(profile.equipment)
    && Array.isArray(profile.maintenanceRecords)
    && Array.isArray(profile.upcomingMaintenance);
}

export function normalizeMyHomeProfile(rawProfile) {
  const base = createDefaultMyHomeProfile();
  const profile = isPlainObject(rawProfile) ? rawProfile : {};
  const normalizedReminders = Array.isArray(profile.upcomingMaintenance) && profile.upcomingMaintenance.length
    ? profile.upcomingMaintenance.map(item => normalizeTaskEntry(item, { includeTarget: true })).filter(item => item.task)
    : [];

  return {
    appId: APP_ID,
    recordType: RECORD_TYPE,
    propertyId: toStringValue(profile.propertyId) || LOCAL_PROPERTY_ID,
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
    propertyDocuments: Array.isArray(profile.propertyDocuments || profile.documentsAndWarranties)
      ? dedupeDocumentRecords((profile.propertyDocuments || profile.documentsAndWarranties)
        .map(item => normalizeDocumentRecord(item, normalizeDocumentType(item?.type))))
      : [],
    maintenanceRecords: Array.isArray(profile.maintenanceRecords)
      ? profile.maintenanceRecords.map(normalizeMaintenanceEntry).filter(item => item.equipment && item.servicePerformed)
      : [],
    upcomingMaintenance: normalizedReminders.length ? normalizedReminders : base.upcomingMaintenance
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

export function updateEquipment(equipmentId, patch, storage) {
  const profile = loadMyHomeProfile(storage);
  const existing = profile.equipment.find(item => item.id === equipmentId);
  if (!existing) return profile;

  const normalizedEntry = normalizeEquipmentEntry({
    ...existing,
    ...patch,
    id: equipmentId,
    warranty: {
      ...existing.warranty,
      ...(isPlainObject(patch?.warranty) ? patch.warranty : {})
    },
    documents: {
      ...existing.documents,
      ...(isPlainObject(patch?.documents) ? patch.documents : {}),
      ownerManual: {
        ...existing.documents.ownerManual,
        ...(isPlainObject(patch?.documents?.ownerManual) ? patch.documents.ownerManual : {})
      },
      installationManual: {
        ...existing.documents.installationManual,
        ...(isPlainObject(patch?.documents?.installationManual) ? patch.documents.installationManual : {})
      },
      warrantyDocument: {
        ...existing.documents.warrantyDocument,
        ...(isPlainObject(patch?.documents?.warrantyDocument) ? patch.documents.warrantyDocument : {})
      },
      receipt: {
        ...existing.documents.receipt,
        ...(isPlainObject(patch?.documents?.receipt) ? patch.documents.receipt : {})
      },
      partsReference: {
        ...existing.documents.partsReference,
        ...(isPlainObject(patch?.documents?.partsReference) ? patch.documents.partsReference : {})
      }
    }
  });

  if (!normalizedEntry.type) return profile;

  return saveMyHomeProfile({
    ...profile,
    equipment: profile.equipment.map(item => (item.id === equipmentId ? normalizedEntry : item))
  }, storage);
}

export function removeEquipment(equipmentId, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    equipment: profile.equipment.filter(item => item.id !== equipmentId)
  }, storage);
}

export function addEquipmentDocumentRecord(equipmentId, entry, storage) {
  const normalizedEntry = normalizeDocumentRecord(entry, normalizeDocumentType(entry?.type));
  if (!hasDocumentRecordContent(normalizedEntry)) {
    return loadMyHomeProfile(storage);
  }

  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    documentRecords: dedupeDocumentRecords([...equipment.documentRecords, normalizedEntry])
  }));
}

export function removeEquipmentDocumentRecord(equipmentId, documentId, storage) {
  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    documentRecords: equipment.documentRecords.filter(item => item.id !== documentId)
  }));
}

function updateEquipmentCollection(equipmentId, storage, updater) {
  const profile = loadMyHomeProfile(storage);
  const targetEquipment = profile.equipment.find(item => item.id === equipmentId);
  if (!targetEquipment) return profile;

  return saveMyHomeProfile({
    ...profile,
    equipment: profile.equipment.map(item => {
      if (item.id !== equipmentId) return item;
      return updater(item);
    })
  }, storage);
}

export function addEquipmentServiceHistory(equipmentId, entry, storage) {
  const normalizedEntry = normalizeMaintenanceEntry(entry);
  if (!normalizedEntry.date || !normalizedEntry.servicePerformed) {
    return loadMyHomeProfile(storage);
  }

  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    serviceHistory: [...equipment.serviceHistory, normalizedEntry]
  }));
}

export function removeEquipmentServiceHistory(equipmentId, historyId, storage) {
  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    serviceHistory: equipment.serviceHistory.filter(item => item.id !== historyId)
  }));
}

export function addEquipmentMaintenanceTask(equipmentId, entry, storage) {
  const normalizedEntry = normalizeTaskEntry(entry);
  if (!normalizedEntry.task) {
    return loadMyHomeProfile(storage);
  }

  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    maintenanceTasks: [...equipment.maintenanceTasks, normalizedEntry]
  }));
}

export function updateEquipmentMaintenanceTask(equipmentId, taskId, patch, storage) {
  const profile = loadMyHomeProfile(storage);
  const equipment = profile.equipment.find(item => item.id === equipmentId);
  const existing = equipment?.maintenanceTasks.find(item => item.id === taskId);
  if (!equipment || !existing) return profile;

  const normalizedEntry = normalizeTaskEntry({ ...existing, ...patch, id: taskId });
  if (!normalizedEntry.task) return profile;

  return updateEquipmentCollection(equipmentId, storage, current => ({
    ...current,
    maintenanceTasks: current.maintenanceTasks.map(item => (item.id === taskId ? normalizedEntry : item))
  }));
}

export function removeEquipmentMaintenanceTask(equipmentId, taskId, storage) {
  return updateEquipmentCollection(equipmentId, storage, equipment => ({
    ...equipment,
    maintenanceTasks: equipment.maintenanceTasks.filter(item => item.id !== taskId)
  }));
}

export function markEquipmentMaintenanceTaskCompleted(equipmentId, taskId, completedAt = todayIso(), storage) {
  return updateEquipmentMaintenanceTask(equipmentId, taskId, {
    completed: true,
    lastCompletedDate: completedAt,
    nextDueDate: ''
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

export function addPropertyDocumentRecord(entry, storage) {
  const profile = loadMyHomeProfile(storage);
  const normalizedEntry = normalizeDocumentRecord(entry, normalizeDocumentType(entry?.type));
  if (!hasDocumentRecordContent(normalizedEntry)) return profile;
  return saveMyHomeProfile({
    ...profile,
    propertyDocuments: dedupeDocumentRecords([...profile.propertyDocuments, normalizedEntry])
  }, storage);
}

export function removePropertyDocumentRecord(documentId, storage) {
  const profile = loadMyHomeProfile(storage);
  return saveMyHomeProfile({
    ...profile,
    propertyDocuments: profile.propertyDocuments.filter(item => item.id !== documentId)
  }, storage);
}

export function addUpcomingMaintenance(entry, storage) {
  const profile = loadMyHomeProfile(storage);
  const normalizedEntry = normalizeTaskEntry(entry, { includeTarget: true });
  if (!normalizedEntry.task) return profile;
  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: [...profile.upcomingMaintenance, normalizedEntry]
  }, storage);
}

export function updateUpcomingMaintenance(reminderId, patch, storage) {
  const profile = loadMyHomeProfile(storage);
  const existing = profile.upcomingMaintenance.find(item => item.id === reminderId);
  if (!existing) return profile;

  const normalizedEntry = normalizeTaskEntry({ ...existing, ...patch, id: reminderId }, { includeTarget: true });
  if (!normalizedEntry.task) return profile;

  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: profile.upcomingMaintenance.map(item => (item.id === reminderId ? normalizedEntry : item))
  }, storage);
}

export function removeUpcomingMaintenance(reminderId, storage) {
  const profile = loadMyHomeProfile(storage);
  const remaining = profile.upcomingMaintenance.filter(item => item.id !== reminderId);
  return saveMyHomeProfile({
    ...profile,
    upcomingMaintenance: remaining.length ? remaining : createStarterReminders()
  }, storage);
}

export function exportMyHomeProfile(storage) {
  const profile = loadMyHomeProfile(storage);
  return JSON.stringify({
    ...profile,
    exportedAt: nowIso()
  }, null, 2);
}

export function importMyHomeProfile(serializedProfile, storage) {
  if (!toStringValue(serializedProfile)) {
    return { ok: false, error: 'Choose a JSON backup file from A to Z Wise AI My Home.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(serializedProfile);
  } catch (err) {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!hasRecognizedImportShape(parsed)) {
    return { ok: false, error: 'That JSON file is not a recognized A to Z Wise AI My Home backup.' };
  }

  const savedProfile = saveMyHomeProfile(parsed, storage);
  return { ok: true, profile: savedProfile };
}
