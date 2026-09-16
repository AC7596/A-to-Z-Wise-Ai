import { escapeHtml } from '../utils/html.js';
import {
  addEquipment,
  addEquipmentMaintenanceTask,
  addEquipmentServiceHistory,
  addMaintenanceRecord,
  addUpcomingMaintenance,
  exportMyHomeProfile,
  getMaintenanceTaskStatus,
  getWarrantyStatus,
  importMyHomeProfile,
  loadMyHomeProfile,
  markEquipmentMaintenanceTaskCompleted,
  removeEquipment,
  removeEquipmentMaintenanceTask,
  removeEquipmentServiceHistory,
  removeMaintenanceRecord,
  removeUpcomingMaintenance,
  updateEquipment,
  updateHomeInfo,
  updateUpcomingMaintenance
} from './my-home-store.js';

let profile = null;
let isBound = false;
let editingEquipmentId = '';
const els = {};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatText(value, fallback = 'Not added yet') {
  return value ? escapeHtml(value) : fallback;
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
    'myHomeEquipmentEditingId',
    'myHomeEquipmentType',
    'myHomeEquipmentManufacturer',
    'myHomeEquipmentModel',
    'myHomeEquipmentSerial',
    'myHomeEquipmentInstallDate',
    'myHomeEquipmentManufactureDate',
    'myHomeEquipmentApproximateAge',
    'myHomeEquipmentLocation',
    'myHomeEquipmentInstaller',
    'myHomeEquipmentWarrantyStart',
    'myHomeEquipmentWarrantyExpiration',
    'myHomeEquipmentWarrantyProvider',
    'myHomeEquipmentWarrantyNumber',
    'myHomeEquipmentWarrantyNotes',
    'myHomeEquipmentPartsInfo',
    'myHomeEquipmentOwnerManualName',
    'myHomeEquipmentOwnerManualUrl',
    'myHomeEquipmentInstallManualName',
    'myHomeEquipmentInstallManualUrl',
    'myHomeEquipmentWarrantyDocName',
    'myHomeEquipmentWarrantyDocUrl',
    'myHomeEquipmentReceiptName',
    'myHomeEquipmentReceiptUrl',
    'myHomeEquipmentModelNotes',
    'myHomeEquipmentNotes',
    'myHomeEquipmentSubmit',
    'myHomeEquipmentCancel',
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
    'myHomeReminderCount',
    'myHomeExportButton',
    'myHomeImportFile',
    'myHomeImportFeedback'
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function setSaveMessage(message) {
  if (els.myHomeSaveMessage) els.myHomeSaveMessage.textContent = message;
}

function setImportMessage(message, isError = false) {
  if (!els.myHomeImportFeedback) return;
  els.myHomeImportFeedback.textContent = message;
  els.myHomeImportFeedback.dataset.state = isError ? 'error' : 'success';
}

function homeLabel() {
  const nickname = profile.homeInfo.nickname;
  const address = profile.homeInfo.address;
  if (nickname && address) return `${nickname} · ${address}`;
  return nickname || address || 'Your digital home property record';
}

function equipmentLabel(item) {
  const manufacturerModel = [item.manufacturer, item.modelNumber].filter(Boolean).join(' · ');
  return manufacturerModel ? `${item.type} — ${manufacturerModel}` : item.type;
}

function countEquipmentServiceHistory() {
  return profile.equipment.reduce((total, item) => total + item.serviceHistory.length, 0);
}

function countEquipmentTasks() {
  return profile.equipment.reduce((total, item) => total + item.maintenanceTasks.length, 0);
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

function resetEquipmentForm() {
  editingEquipmentId = '';
  els.myHomeEquipmentForm?.reset();
  if (els.myHomeEquipmentEditingId) els.myHomeEquipmentEditingId.value = '';
  if (els.myHomeEquipmentSubmit) els.myHomeEquipmentSubmit.textContent = 'Add equipment record';
  if (els.myHomeEquipmentCancel) els.myHomeEquipmentCancel.hidden = true;
}

function populateEquipmentForm() {
  if (!els.myHomeEquipmentForm) return;
  const equipment = profile.equipment.find(item => item.id === editingEquipmentId);

  if (!equipment) {
    resetEquipmentForm();
    return;
  }

  els.myHomeEquipmentEditingId.value = equipment.id;
  els.myHomeEquipmentType.value = equipment.type;
  els.myHomeEquipmentManufacturer.value = equipment.manufacturer;
  els.myHomeEquipmentModel.value = equipment.modelNumber;
  els.myHomeEquipmentSerial.value = equipment.serialNumber;
  els.myHomeEquipmentInstallDate.value = equipment.installationDate;
  els.myHomeEquipmentManufactureDate.value = equipment.manufactureDate;
  els.myHomeEquipmentApproximateAge.value = equipment.approximateAge;
  els.myHomeEquipmentLocation.value = equipment.location;
  els.myHomeEquipmentInstaller.value = equipment.installer;
  els.myHomeEquipmentWarrantyStart.value = equipment.warranty.startDate;
  els.myHomeEquipmentWarrantyExpiration.value = equipment.warranty.expirationDate;
  els.myHomeEquipmentWarrantyProvider.value = equipment.warranty.provider;
  els.myHomeEquipmentWarrantyNumber.value = equipment.warranty.number;
  els.myHomeEquipmentWarrantyNotes.value = equipment.warranty.notes;
  els.myHomeEquipmentPartsInfo.value = equipment.partsInformation;
  els.myHomeEquipmentOwnerManualName.value = equipment.documents.ownerManual.name;
  els.myHomeEquipmentOwnerManualUrl.value = equipment.documents.ownerManual.url;
  els.myHomeEquipmentInstallManualName.value = equipment.documents.installationManual.name;
  els.myHomeEquipmentInstallManualUrl.value = equipment.documents.installationManual.url;
  els.myHomeEquipmentWarrantyDocName.value = equipment.documents.warrantyDocument.name;
  els.myHomeEquipmentWarrantyDocUrl.value = equipment.documents.warrantyDocument.url;
  els.myHomeEquipmentReceiptName.value = equipment.documents.receipt.name;
  els.myHomeEquipmentReceiptUrl.value = equipment.documents.receipt.url;
  els.myHomeEquipmentModelNotes.value = equipment.documents.modelSpecificNotes;
  els.myHomeEquipmentNotes.value = equipment.notes;
  if (els.myHomeEquipmentSubmit) els.myHomeEquipmentSubmit.textContent = 'Save equipment changes';
  if (els.myHomeEquipmentCancel) els.myHomeEquipmentCancel.hidden = false;
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
    const addressLine = [profile.homeInfo.address || 'Address not added yet', ...parts].filter(Boolean).join(' · ');
    els.myHomeSummaryAddress.textContent = profile.homeInfo.address || parts.length
      ? addressLine
      : 'Add your home details to begin building its long-term property record.';
  }
  if (els.myHomeEquipmentCount) els.myHomeEquipmentCount.textContent = String(profile.equipment.length);
  if (els.myHomeMaintenanceCount) {
    els.myHomeMaintenanceCount.textContent = String(profile.maintenanceRecords.length + countEquipmentServiceHistory());
  }
  if (els.myHomeReminderCount) {
    els.myHomeReminderCount.textContent = String(profile.upcomingMaintenance.length + countEquipmentTasks());
  }
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

function dateDetailRow(label, value) {
  if (!value) return '';
  return detailRow(label, formatDate(value));
}

function renderDocumentItem(label, documentLink) {
  if (!documentLink.name && !documentLink.url) return '';
  const link = documentLink.url
    ? `
      <a href="${escapeHtml(documentLink.url)}" target="_blank" rel="noreferrer noopener">
        ${escapeHtml(documentLink.name || documentLink.url)}
      </a>
      ${documentLink.name ? `<span>${escapeHtml(documentLink.url)}</span>` : ''}
    `
    : `<span>${escapeHtml(documentLink.name || 'Name not added')}</span>`;

  return `
    <li>
      <strong>${escapeHtml(label)}</strong>
      ${link}
    </li>
  `;
}

function renderServiceHistoryList(serviceHistory, equipmentId) {
  if (!serviceHistory.length) {
    return '<p class="my-home-browser-note">No service history has been added for this equipment yet.</p>';
  }

  return `
    <div class="my-home-subcollection">
      ${serviceHistory
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(item => `
          <article class="my-home-subentry">
            <div class="my-home-entry-header">
              <div>
                <h5>${escapeHtml(item.servicePerformed)}</h5>
                <p>${escapeHtml(formatDate(item.date))}</p>
              </div>
              <button
                type="button"
                class="btn secondary my-home-remove-btn"
                data-action="delete-equipment-history"
                data-equipment-id="${escapeHtml(equipmentId)}"
                data-id="${escapeHtml(item.id)}"
              >Remove</button>
            </div>
            <div class="my-home-entry-grid">
              ${detailRow('Parts replaced', item.partsReplaced)}
              ${detailRow('Contractor / DIY', item.performedBy)}
              ${detailRow('Cost', item.cost)}
            </div>
            ${item.notes ? `<p class="my-home-entry-note">${escapeHtml(item.notes)}</p>` : ''}
          </article>
        `)
        .join('')}
    </div>
  `;
}

function renderTaskCard(task, equipmentId) {
  const status = getMaintenanceTaskStatus(task);
  return `
    <article class="my-home-subentry">
      <div class="my-home-entry-header">
        <div>
          <div class="my-home-status-line">
            <h5>${escapeHtml(task.task)}</h5>
            <span class="my-home-status-pill ${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span>
          </div>
          <p>${escapeHtml(task.intervalBasis === 'manufacturer' ? 'Manufacturer / installer guidance' : 'General guidance')}</p>
        </div>
        <div class="my-home-inline-actions">
          <button
            type="button"
            class="btn secondary"
            data-action="complete-equipment-task"
            data-equipment-id="${escapeHtml(equipmentId)}"
            data-id="${escapeHtml(task.id)}"
          >Mark completed</button>
          <button
            type="button"
            class="btn secondary my-home-remove-btn"
            data-action="delete-equipment-task"
            data-equipment-id="${escapeHtml(equipmentId)}"
            data-id="${escapeHtml(task.id)}"
          >Remove</button>
        </div>
      </div>
      <div class="my-home-entry-grid">
        ${detailRow('Recommended interval', task.recommendedInterval)}
        ${dateDetailRow('Last completed', task.lastCompletedDate)}
        ${dateDetailRow('Next due', task.nextDueDate)}
      </div>
      ${task.notes ? `<p class="my-home-entry-note">${escapeHtml(task.notes)}</p>` : ''}
    </article>
  `;
}

function renderEquipmentTaskList(tasks, equipmentId) {
  if (!tasks.length) {
    return '<p class="my-home-browser-note">No equipment-specific maintenance schedule has been added yet.</p>';
  }

  return `<div class="my-home-subcollection">${tasks.map(task => renderTaskCard(task, equipmentId)).join('')}</div>`;
}

function renderEquipmentCard(item) {
  const warrantyStatus = getWarrantyStatus(item.warranty);
  const documentItems = [
    renderDocumentItem('Owner manual', item.documents.ownerManual),
    renderDocumentItem('Installation manual', item.documents.installationManual),
    renderDocumentItem('Warranty documentation', item.documents.warrantyDocument),
    renderDocumentItem('Receipt', item.documents.receipt)
  ].filter(Boolean);

  return `
    <article class="my-home-entry my-home-equipment-record">
      <div class="my-home-entry-header">
        <div>
          <div class="my-home-status-line">
            <h4>${escapeHtml(item.type)}</h4>
            <span class="my-home-status-pill ${escapeHtml(warrantyStatus.toLowerCase())}">${escapeHtml(warrantyStatus)} warranty</span>
          </div>
          <p>${escapeHtml([item.manufacturer, item.modelNumber].filter(Boolean).join(' · ') || 'Manufacturer and model not added yet')}</p>
        </div>
        <div class="my-home-inline-actions">
          <button type="button" class="btn secondary" data-action="edit-equipment" data-id="${escapeHtml(item.id)}">Edit</button>
          <button type="button" class="btn secondary my-home-remove-btn" data-action="delete-equipment" data-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>

      <div class="my-home-entry-grid">
        ${detailRow('Serial number', item.serialNumber)}
        ${dateDetailRow('Installation date', item.installationDate)}
        ${dateDetailRow('Manufacture date', item.manufactureDate)}
        ${detailRow('Approximate age', item.approximateAge)}
        ${detailRow('Location', item.location)}
        ${detailRow('Installer / contractor', item.installer)}
        ${dateDetailRow('Warranty start', item.warranty.startDate)}
        ${dateDetailRow('Warranty expiration', item.warranty.expirationDate)}
        ${detailRow('Warranty provider', item.warranty.provider)}
        ${detailRow('Warranty number', item.warranty.number)}
        ${detailRow('Parts information', item.partsInformation)}
      </div>

      ${item.notes ? `<p class="my-home-entry-note">${escapeHtml(item.notes)}</p>` : ''}

      <section class="my-home-detail-section">
        <div class="my-home-section-header">
          <h5>Warranty details</h5>
          <span>${escapeHtml(warrantyStatus === 'Unknown' ? 'We only mark a warranty active when an expiration date is on file.' : '')}</span>
        </div>
        ${item.warranty.notes ? `<p class="my-home-entry-note">${escapeHtml(item.warranty.notes)}</p>` : '<p class="my-home-browser-note">Add provider, number, and notes if you have them.</p>'}
      </section>

      <section class="my-home-detail-section">
        <div class="my-home-section-header">
          <h5>Manuals & documents</h5>
          <span>Browser-only: save names and lawful URLs for now.</span>
        </div>
        ${documentItems.length ? `<ul class="my-home-document-list">${documentItems.join('')}</ul>` : '<p class="my-home-browser-note">No document names or URLs have been saved yet.</p>'}
        ${item.documents.modelSpecificNotes ? `<p class="my-home-entry-note">${escapeHtml(item.documents.modelSpecificNotes)}</p>` : ''}
      </section>

      <section class="my-home-detail-section">
        <div class="my-home-section-header">
          <h5>Service & repair history</h5>
          <span>Each item stays attached to this exact equipment record.</span>
        </div>
        ${renderServiceHistoryList(item.serviceHistory, item.id)}
        <form class="my-home-form my-home-nested-form" data-form-type="equipment-history" data-equipment-id="${escapeHtml(item.id)}">
          <div class="my-home-form-grid">
            <label>
              Date
              <input name="date" type="date" required />
            </label>
            <label>
              Maintenance or repair performed
              <input name="servicePerformed" type="text" placeholder="Annual tune-up, capacitor replacement..." required />
            </label>
            <label>
              Parts replaced
              <input name="partsReplaced" type="text" placeholder="Filter, igniter, capacitor..." />
            </label>
            <label>
              Contractor or DIY
              <input name="performedBy" type="text" placeholder="DIY, ABC HVAC, warranty visit..." />
            </label>
            <label>
              Cost
              <input name="cost" type="text" inputmode="decimal" placeholder="$0.00" />
            </label>
            <label class="my-home-full">
              Notes
              <textarea name="notes" rows="3" placeholder="Findings, follow-up, part numbers, receipts..."></textarea>
            </label>
          </div>
          <div class="my-home-card-actions">
            <button type="submit" class="btn primary">Add service history</button>
          </div>
        </form>
      </section>

      <section class="my-home-detail-section">
        <div class="my-home-section-header">
          <h5>Maintenance schedule</h5>
          <span>Use general guidance unless you have verified manufacturer or installer instructions.</span>
        </div>
        ${renderEquipmentTaskList(item.maintenanceTasks, item.id)}
        <form class="my-home-form my-home-nested-form" data-form-type="equipment-task" data-equipment-id="${escapeHtml(item.id)}">
          <div class="my-home-form-grid">
            <label>
              Task
              <input name="task" type="text" placeholder="Replace return-air filter" required />
            </label>
            <label>
              Recommended interval
              <input name="recommendedInterval" type="text" placeholder="Every 1-3 months" />
            </label>
            <label>
              Interval basis
              <select name="intervalBasis">
                <option value="general">General guidance</option>
                <option value="manufacturer">Manufacturer / installer guidance</option>
              </select>
            </label>
            <label>
              Last completed date
              <input name="lastCompletedDate" type="date" />
            </label>
            <label>
              Next due date
              <input name="nextDueDate" type="date" />
            </label>
            <label class="my-home-checkbox">
              <input name="completed" type="checkbox" />
              Mark as completed for now
            </label>
            <label class="my-home-full">
              Notes
              <textarea name="notes" rows="3" placeholder="Filter size, access steps, seasonal notes, or verified source"></textarea>
            </label>
          </div>
          <div class="my-home-card-actions">
            <button type="submit" class="btn primary">Add maintenance task</button>
          </div>
        </form>
      </section>
    </article>
  `;
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
  els.myHomeEquipmentList.innerHTML = items.map(renderEquipmentCard).join('');
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
        ${detailRow('Parts replaced', item.partsReplaced)}
        ${detailRow('Contractor / DIY', item.performedBy)}
        ${detailRow('Cost', item.cost)}
      </div>
      ${item.notes ? `<p class="my-home-entry-note">${escapeHtml(item.notes)}</p>` : ''}
    </article>
  `).join('');
}

function renderGeneralReminderForm(item) {
  const status = getMaintenanceTaskStatus(item);
  return `
    <form class="my-home-entry my-home-inline-form" data-reminder-id="${escapeHtml(item.id)}">
      <div class="my-home-entry-header">
        <div>
          <div class="my-home-status-line">
            <h4>${escapeHtml(item.task)}</h4>
            <span class="my-home-status-pill ${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span>
          </div>
          <p>${escapeHtml(item.target || 'General property reminder')}</p>
        </div>
        <div class="my-home-inline-actions">
          <button type="button" class="btn secondary" data-action="complete-reminder" data-id="${escapeHtml(item.id)}">Mark completed</button>
          <button type="button" class="btn secondary my-home-remove-btn" data-action="delete-reminder" data-id="${escapeHtml(item.id)}">Remove</button>
        </div>
      </div>
      <div class="my-home-inline-grid">
        <label for="my-home-reminder-task-${escapeHtml(item.id)}">
          Task
          <input id="my-home-reminder-task-${escapeHtml(item.id)}" name="task" type="text" value="${escapeHtml(item.task)}" required />
        </label>
        <label for="my-home-reminder-target-${escapeHtml(item.id)}">
          Equipment / area
          <input id="my-home-reminder-target-${escapeHtml(item.id)}" name="target" type="text" value="${escapeHtml(item.target)}" list="myHomeEquipmentOptions" />
        </label>
        <label for="my-home-reminder-interval-${escapeHtml(item.id)}">
          Recommended interval
          <input id="my-home-reminder-interval-${escapeHtml(item.id)}" name="recommendedInterval" type="text" value="${escapeHtml(item.recommendedInterval)}" />
        </label>
        <label for="my-home-reminder-basis-${escapeHtml(item.id)}">
          Interval basis
          <select id="my-home-reminder-basis-${escapeHtml(item.id)}" name="intervalBasis">
            <option value="general"${item.intervalBasis === 'general' ? ' selected' : ''}>General guidance</option>
            <option value="manufacturer"${item.intervalBasis === 'manufacturer' ? ' selected' : ''}>Manufacturer / installer guidance</option>
          </select>
        </label>
        <label for="my-home-reminder-last-${escapeHtml(item.id)}">
          Last completed date
          <input id="my-home-reminder-last-${escapeHtml(item.id)}" name="lastCompletedDate" type="date" value="${escapeHtml(item.lastCompletedDate)}" />
        </label>
        <label for="my-home-reminder-date-${escapeHtml(item.id)}">
          Next due date
          <input id="my-home-reminder-date-${escapeHtml(item.id)}" name="nextDueDate" type="date" value="${escapeHtml(item.nextDueDate)}" />
        </label>
        <label class="my-home-checkbox" for="my-home-reminder-complete-${escapeHtml(item.id)}">
          <input id="my-home-reminder-complete-${escapeHtml(item.id)}" name="completed" type="checkbox"${item.completed ? ' checked' : ''} />
          Mark as completed
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
  `;
}

function renderReminderList() {
  if (!els.myHomeReminderList) return;
  els.myHomeReminderList.innerHTML = profile.upcomingMaintenance.map(renderGeneralReminderForm).join('');
}

function renderAll() {
  populateHomeInfoForm();
  renderSummary();
  renderEquipmentOptions();
  renderEquipmentList();
  renderMaintenanceList();
  renderReminderList();
  populateEquipmentForm();
}

function readFormValues(form) {
  const formData = new FormData(form);
  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value).trim()]));
  form.querySelectorAll('input[type="checkbox"]').forEach(input => {
    values[input.name] = input.checked ? 'true' : 'false';
  });
  return values;
}

function readEquipmentFormValues() {
  const values = readFormValues(els.myHomeEquipmentForm);
  return {
    type: values.type,
    manufacturer: values.manufacturer,
    modelNumber: values.modelNumber,
    serialNumber: values.serialNumber,
    installationDate: values.installationDate,
    manufactureDate: values.manufactureDate,
    approximateAge: values.approximateAge,
    location: values.location,
    installer: values.installer,
    notes: values.notes,
    partsInformation: values.partsInformation,
    warranty: {
      startDate: values.warrantyStartDate,
      expirationDate: values.warrantyExpirationDate,
      provider: values.warrantyProvider,
      number: values.warrantyNumber,
      notes: values.warrantyNotes
    },
    documents: {
      ownerManual: {
        name: values.ownerManualName,
        url: values.ownerManualUrl
      },
      installationManual: {
        name: values.installationManualName,
        url: values.installationManualUrl
      },
      warrantyDocument: {
        name: values.warrantyDocumentName,
        url: values.warrantyDocumentUrl
      },
      receipt: {
        name: values.receiptName,
        url: values.receiptUrl
      },
      modelSpecificNotes: values.modelSpecificNotes
    }
  };
}

function downloadBackupFile(content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `a-to-z-wise-ai-my-home-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindForms() {
  els.myHomeInfoForm?.addEventListener('submit', e => {
    e.preventDefault();
    profile = updateHomeInfo(readFormValues(els.myHomeInfoForm));
    renderAll();
    setSaveMessage(`Saved ${homeLabel()} in this browser on this device.`);
  });

  els.myHomeEquipmentForm?.addEventListener('submit', e => {
    e.preventDefault();
    const editingId = els.myHomeEquipmentEditingId?.value || '';
    profile = editingId
      ? updateEquipment(editingId, readEquipmentFormValues())
      : addEquipment(readEquipmentFormValues());
    renderAll();
    resetEquipmentForm();
    setSaveMessage(editingId
      ? 'Equipment record updated in your My Home property record.'
      : 'Equipment record saved to your My Home property record in this browser.');
  });

  els.myHomeEquipmentCancel?.addEventListener('click', () => {
    resetEquipmentForm();
    setSaveMessage('Equipment editing canceled.');
  });

  els.myHomeMaintenanceForm?.addEventListener('submit', e => {
    e.preventDefault();
    profile = addMaintenanceRecord(readFormValues(els.myHomeMaintenanceForm));
    els.myHomeMaintenanceForm.reset();
    renderAll();
    setSaveMessage('Property-wide service record saved to your My Home timeline in this browser.');
  });

  els.myHomeReminderForm?.addEventListener('submit', e => {
    e.preventDefault();
    profile = addUpcomingMaintenance(readFormValues(els.myHomeReminderForm));
    els.myHomeReminderForm.reset();
    renderAll();
    setSaveMessage('Property reminder saved to your My Home maintenance list in this browser.');
  });

  els.myHomeExportButton?.addEventListener('click', () => {
    downloadBackupFile(exportMyHomeProfile());
    setImportMessage('JSON backup downloaded from this browser copy of My Home.');
  });

  els.myHomeImportFile?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = importMyHomeProfile(await file.text());
    if (!result.ok) {
      setImportMessage(result.error, true);
      e.target.value = '';
      return;
    }
    profile = result.profile;
    editingEquipmentId = '';
    renderAll();
    e.target.value = '';
    setImportMessage('My Home backup imported successfully into this browser.');
    setSaveMessage('Imported My Home backup saved in this browser on this device.');
  });
}

function bindCollectionActions() {
  const myHomeSection = document.getElementById('my-home');
  myHomeSection?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'edit-equipment') {
      editingEquipmentId = btn.dataset.id || '';
      populateEquipmentForm();
      els.myHomeEquipmentForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSaveMessage('Editing equipment record.');
      return;
    }

    if (btn.dataset.action === 'delete-equipment') {
      if (editingEquipmentId === btn.dataset.id) editingEquipmentId = '';
      profile = removeEquipment(btn.dataset.id);
      renderAll();
      setSaveMessage('Equipment removed from your My Home property record.');
      return;
    }

    if (btn.dataset.action === 'delete-maintenance') {
      profile = removeMaintenanceRecord(btn.dataset.id);
      renderAll();
      setSaveMessage('Property service record removed from your My Home timeline.');
      return;
    }

    if (btn.dataset.action === 'delete-reminder') {
      profile = removeUpcomingMaintenance(btn.dataset.id);
      renderAll();
      setSaveMessage('Property reminder removed from your My Home maintenance list.');
      return;
    }

    if (btn.dataset.action === 'complete-reminder') {
      profile = updateUpcomingMaintenance(btn.dataset.id, {
        completed: true,
        lastCompletedDate: new Date().toISOString().slice(0, 10)
      });
      renderAll();
      setSaveMessage('Property reminder marked completed.');
      return;
    }

    if (btn.dataset.action === 'delete-equipment-history') {
      profile = removeEquipmentServiceHistory(btn.dataset.equipmentId, btn.dataset.id);
      renderAll();
      setSaveMessage('Equipment service history entry removed.');
      return;
    }

    if (btn.dataset.action === 'delete-equipment-task') {
      profile = removeEquipmentMaintenanceTask(btn.dataset.equipmentId, btn.dataset.id);
      renderAll();
      setSaveMessage('Equipment maintenance task removed.');
      return;
    }

    if (btn.dataset.action === 'complete-equipment-task') {
      profile = markEquipmentMaintenanceTaskCompleted(
        btn.dataset.equipmentId,
        btn.dataset.id,
        new Date().toISOString().slice(0, 10)
      );
      renderAll();
      setSaveMessage('Equipment maintenance task marked completed.');
    }
  });

  els.myHomeReminderList?.addEventListener('submit', e => {
    const form = e.target.closest('.my-home-inline-form');
    if (!form) return;
    e.preventDefault();
    profile = updateUpcomingMaintenance(form.dataset.reminderId, readFormValues(form));
    renderAll();
    setSaveMessage('Property reminder updated in your My Home maintenance list.');
  });

  els.myHomeEquipmentList?.addEventListener('submit', e => {
    const form = e.target.closest('.my-home-nested-form');
    if (!form) return;
    e.preventDefault();
    const values = readFormValues(form);
    const equipmentId = form.dataset.equipmentId;

    if (form.dataset.formType === 'equipment-history') {
      profile = addEquipmentServiceHistory(equipmentId, values);
      form.reset();
      renderAll();
      setSaveMessage('Equipment service history saved in your My Home property record.');
      return;
    }

    if (form.dataset.formType === 'equipment-task') {
      profile = addEquipmentMaintenanceTask(equipmentId, values);
      form.reset();
      renderAll();
      setSaveMessage('Equipment maintenance task saved in your My Home property record.');
    }
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
