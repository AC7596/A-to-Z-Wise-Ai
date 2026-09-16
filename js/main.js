// ========================================
// FIXWISE AI — main entry point
// ========================================
import { initNav } from './modules/nav.js';
import { initPhotoUpload } from './modules/photo-upload.js';
import { initDiagnosisForm } from './modules/diagnosis.js';
import { initGuides } from './modules/guides.js';
import { initFixy } from './modules/kids.js';
import { initKidsActivities } from './modules/kids-activities.js';
import { initMyHome } from './modules/my-home.js';
import { initRepairMode } from './modules/repair-mode.js';
import { initMonetization } from './modules/monetization.js';

initNav();
initPhotoUpload({ inputId: 'photoUpload', previewGridId: 'photoPreviewGrid', errorId: 'photoError', countLabelId: 'photoCountLabel', dropZoneId: 'uploadBox' });
initDiagnosisForm();
initGuides();
initFixy();
initKidsActivities();
initMyHome();
initRepairMode();
initMonetization();
