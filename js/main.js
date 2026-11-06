// ========================================
// FIXWISE AI — main entry point
// ========================================
import { initNav } from './modules/nav.js';
import { initPhotoUpload } from './modules/photo-upload.js';
import { initDiagnosisForm } from './modules/diagnosis.js?v=private-home-2';
import { initGuides } from './modules/guides.js';
import { initFixy } from './modules/kids.js';
import { initKidsActivities } from './modules/kids-activities.js';
import { initMyHome } from './modules/my-home.js?v=private-home-2';
import { initRepairMode } from './modules/repair-mode.js';
import { initMonetization } from './modules/monetization.js';

import { bindHomePageScope } from './modules/my-home-store.js?v=private-home-2';
bindHomePageScope();
initNav();
initPhotoUpload({ inputId: 'photoUpload', previewGridId: 'photoPreviewGrid', errorId: 'photoError', countLabelId: 'photoCountLabel', dropZoneId: 'uploadBox' });
initDiagnosisForm();
initGuides();
initFixy();
initKidsActivities();
initMyHome();
initRepairMode();
initMonetization();
