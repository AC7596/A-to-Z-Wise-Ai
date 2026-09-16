import { escapeHtml } from '../utils/html.js';
import {
  addEquipment,
  addMaintenanceRecord,
  addUpcomingMaintenance,
  loadMyHomeProfile,
  removeEquipment,
  removeMaintenanceRecord,
  removeUpcomingMaintenance,
  updateHomeInfo,
  updateUpcomingMaintenance
} from './my-home-store.js';

let profile = null;
let isBound = false;
const els = {};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cacheEls() {
  [
    'myHomeInfoForm',
    'myHomeNickname',
    'myHomeAddress',
    'myHomeYearBuilt',
    'myHomeType',
    'myHomeSquareFootage',
    'myHomeBedrooms',
    'myHomeBathrooms',
    'myHomeEquipmentForm',
    'myHomeEquipmentList',
    'myHomeEquipmentEmpty',
    'myHomeEquipmentOptions',
    'myHomeMaintenanceForm',
    'myHomeMaintenanceList',
    'myHomeMaintenanceEmpty',
    'myHomeReminderForm',
    'myHomeReminderList',
    'myHomeSaveMessage',
    'myHomeSummaryTitle',
    'myHomeSummaryAddress',
    'myHomeEquipmentCount',
    'myHomeMaintenanceCount',
    'myHomeReminderCount'
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function setSaveMessage(message) {
  if (els.myHomeSaveMessage) els.myHomeSaveMessage.textContent = message;
}

function homeLabel() {
  const nickname = profile.homeInfo.nickname;
  const address = profile.homeInfo.address;
  if (nickname && address) return `${nickname} · ${address}`;
  return nickname || address || 'Your digital home profile';
}

function equipmentLabel(item) {
  const manufacturerModel = [item.manufacturer, item.modelNumber].filter(Boolean).join(' · ');
  return manufacturerModel ? `${item.type} — ${manufacturerModel}` : item.type;
}

function populateHomeInfoForm() {
  if (!els.myHomeInfoForm) return;
  els.myHomeNickname.value = profile.homeInfo.nickname;
  els.myHomeAddress.value = profile.homeInfo.address;
  els.myHomeYearBuilt.value = profile.homeInfo.yearBuilt;
  els.myHomeType.value = profile.homeInfo.homeType;
  els.myHomeSquareFootage.value = profile.homeInfo.squareFootage;
  els.myHomeBedrooms.value = profile.homeInfo.bedrooms;
  els.myHomeBathrooms.value = profile.homeInfo.bathrooms;
}

function renderSummary() {
  if (els.myHomeSummaryTitle) els.myHomeSummaryTitle.textContent = homeLabel();
  if (els.myHomeSummaryAddress) {
    const parts = [
      profile.homeInfo.homeType,
      profile.homeInfo.yearBuilt ? `Built ${profile.homeInfo.yearBuilt}` : '',
      profile.homeInfo.squareFootage ? `${profile.homeInfo.squareFootage} sq ft` : '',
      profile.homeInfo.bedrooms ? `${profile.homeInfo.bedrooms} bed` : '',
      profile.homeInfo.bathrooms ? `${profile.homeInfo.bathrooms} bath` : ''
    ].filter(Boolean);
    els.myHomeSummaryAddress.textContent = parts.length
      ? `${profile.homeInfo.address || 'Address not added yet'}${parts.length ? ' · ' + parts.join(' · ') : ''}`
      : 'Add your home details to begin building its record.';
  }
  if (els.myHomeEquipmentCount) els.myHomeEquipmentCount.textContent = String(profile.equipment.length);
  if (els.myHomeMaintenanceCount) els.myHomeMaintenanceCount.textContent = String(profile.maintenanceRecords.length);
  if (els.myHomeReminderCount) els.myHomeReminderCount.textContent = String(profile.upcomingMaintenance.length);
}

function renderEquipmentOptions() {
  if (!els.myHomeEquipmentOptions) return;
  els.myHomeEquipmentOptions.innerHTML = profile.equipment
    .map(item => `<option value="${escapeHtml(equipmentLabel(item))}"></option>`)
    .join('');
}

function detailRow(label, value) {
  if (!value) return '';
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderEquipmentList() {
  if (!els.myHomeEquipmentList) return;
  const items = profile.equipment;
  if (!items.length) {
    els.myHomeEquipmentList.innerHTML = '';
    if (els.myHomeEquipmentEmpty) els.myHomeEquipmentEmpty.style.display = 'block';
    return;
  }
  if (els.myHomeEquipmentEmpty) els.myHomeEquipmentEmpty.style.display = 'none';
  els.myHomeEquipmentList.innerHTML = items.map(item => `
    <article class="my-home-entry">
      <div class="my-home-entry-header">
        <div>
          <h4>${escapeHtml(item.type)}</h4>
          <p>${escapeHtml(item.manufacturer || 'Manufacturer not added yet')}</p>
        </div>
        <button type="button" class="btn secondary my-home-remove-btn" data-action="delete-equipment" data-id="${escapeHtml(item.id)}">Remove</button>
      </div>
      <div class="my-home-entry-grid">
        ${detailRow('Model', item.modelNumber)}
        ${detailRow('Serial', item.serialNumber)}
        ${detailRow('Install / age', item.installationDateOrAge)}
        ${detailRow('Warranty', formatDate(item.warrantyExpiration))}
      </div>
      ${item.notes ? `<p class="my-home-entry-note">${escapeHtml(item.notes)}</p>` : ''}
    </article>
  `).join('');
}

function renderMaintenanceList() {
  if (!els.myHomeMaintenanceList) return;
  const items = [...profile.maintenanceRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!items.length) {
    els.myHomeMaintenanceList.innerHTML = '';
    if (els.myHomeMaintenanceEmpty) els.myHomeMaintenanceEmpty.style.display = 'block';
    return;
  }
  if (els.myHomeMaintenanceEmpty) els.myHomeMaintenanceEmpty.style.display = 'none';
  els.myHomeMaintenanceList.innerHTML = items.map(item => `
    <article class="my-home-entry">
      <div class="my-home-entry-header">
        <div>
          <h4>${escapeHtml(item.equipment)}</h4>
          <p>${escapeHtml(item.servicePerformed)}</p>
        </div>
        <button type="button" class="btn secondary my-home-remove-btn" data-action="delete-maintenance" data-id="${escapeHtml(item.id)}">Remove</button>
      </div>
      <div class="my-home-entry-grid">
        ${detailRow('Date', formatDate(item.date))}
        ${detailRow('Parts used', item.partsUsed)}
      </div>
      ${item.notes ? `<p class="my-home-entry-note">${escapeHtml(item.notes)}</p>` : ''}
    </article>
  `).join('');
}

function renderReminderList() {
  if (!els.myHomeReminderList) return;
  els.myHomeReminderList.innerHTML = profile.upcomingMaintenance.map(item => `
    <form class="my-home-entry my-home-inline-form" data-reminder-id="${escapeHtml(item.id)}">
      <div class="my-home-entry-header">
        <div>
          <h4>${escapeHtml(item.task)}</h4>
          <p>${escapeHtml(item.target || 'General home maintenance')}</p>
        </div>
        <button type="button" class="btn secondary my-home-remove-btn" data-action="delete-reminder" data-id="${escapeHtml(item.id)}">Remove</button>
      </div>
      <div class="my-home-inline-grid">
        <label for="my-home-reminder-task-${escapeHtml(item.id)}">
          Reminder
          <input id="my-home-reminder-task-${escapeHtml(item.id)}" name="task" type="text" value="${escapeHtml(item.task)}" required />
        </label>
        <label for="my-home-reminder-target-${escapeHtml(item.id)}">
          Equipment / area
          <input id="my-home-reminder-target-${escapeHtml(item.id)}" name="target" type="text" value="${escapeHtml(item.target)}" list="myHomeEquipmentOptions" />
        </label>
        <label for="my-home-reminder-date-${escapeHtml(item.id)}">
          Due date
          <input id="my-home-reminder-date-${escapeHtml(item.id)}" name="dueDate" type="date" value="${escapeHtml(item.dueDate)}" />
        </label>
        <label class="my-home-full" for="my-home-reminder-notes-${escapeHtml(item.id)}">
          Notes
          <textarea id="my-home-reminder-notes-${escapeHtml(item.id)}" name="notes" rows="3">${escapeHtml(item.notes)}</textarea>
        </label>
      </div>
      <div class="my-home-card-actions">
        <button type="submit" class="btn primary">Save reminder</button>
      </div>
    </form>
  `).join('');
}

function renderAll() {
  populateHomeInfoForm();
  renderSummary();
  renderEquipmentOptions();
  renderEquipmentList();
  renderMaintenanceList();
  renderReminderList();
}

function readFormValues(form) {
  const formData = new FormData(form);
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value).trim()]));
}

function bindForms() {
  els.myHomeInfoForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = updateHomeInfo(readFormValues(els.myHomeInfoForm));
    renderAll();
    setSaveMessage(`Saved ${homeLabel()} in this browser on this device.`);
  });

  els.myHomeEquipmentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = addEquipment(readFormValues(els.myHomeEquipmentForm));
    els.myHomeEquipmentForm.reset();
    renderAll();
    setSaveMessage('Equipment saved to your My Home profile in this browser.');
  });

  els.myHomeMaintenanceForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = addMaintenanceRecord(readFormValues(els.myHomeMaintenanceForm));
    els.myHomeMaintenanceForm.reset();
    renderAll();
    setSaveMessage('Maintenance record saved to your My Home timeline in this browser.');
  });

  els.myHomeReminderForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = addUpcomingMaintenance(readFormValues(els.myHomeReminderForm));
    els.myHomeReminderForm.reset();
    renderAll();
    setSaveMessage('Reminder added to your My Home maintenance list in this browser.');
  });
}

function bindCollectionActions() {
  const myHomeSection = document.getElementById('my-home');
  myHomeSection?.addEventListener('click', (e) => {
    const btn = e.target.closest('.my-home-remove-btn');
    if (!btn) return;

    if (btn.dataset.action === 'delete-equipment') {
      profile = removeEquipment(btn.dataset.id);
      renderAll();
      setSaveMessage('Equipment removed from your My Home profile.');
    }

    if (btn.dataset.action === 'delete-maintenance') {
      profile = removeMaintenanceRecord(btn.dataset.id);
      renderAll();
      setSaveMessage('Maintenance record removed from your My Home timeline.');
    }

    if (btn.dataset.action === 'delete-reminder') {
      profile = removeUpcomingMaintenance(btn.dataset.id);
      renderAll();
      setSaveMessage('Reminder removed from your My Home maintenance list.');
    }
  });

  els.myHomeReminderList?.addEventListener('submit', (e) => {
    const form = e.target.closest('.my-home-inline-form');
    if (!form) return;
    e.preventDefault();
    profile = updateUpcomingMaintenance(form.dataset.reminderId, readFormValues(form));
    renderAll();
    setSaveMessage('Reminder updated in your My Home maintenance list.');
  });
}

export function initMyHome() {
  if (!document.getElementById('my-home') || isBound) return;
  cacheEls();
  profile = loadMyHomeProfile();
  renderAll();
  bindForms();
  bindCollectionActions();
  isBound = true;
}
