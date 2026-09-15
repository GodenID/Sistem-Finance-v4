/**
 * Konstanta integrasi Project Management (API QL).
 * Direkonstruksi dari build production sebelumnya — repo "Upload pertama"
 * tidak menyertakan file ini sehingga fitur cek QL sempat hilang.
 *
 * API: GET {PM_API_PROJECT}?ql={NOMOR_QL}
 *  - 200: { success: true, data: { name, company_name, status, lokasi, ... } }
 *  - 404: { success: false, error: "Project dengan nomor QL ... tidak ditemukan" }
 */
export const PM_API_PROJECT = 'https://files.project.prasastigroup.id/api/project';
export const PM_API_PROJECTS = 'https://files.project.prasastigroup.id/api/projects';
export const PM_PROJECT_URL = 'https://project.prasastigroup.id/project';

// Format nomor QL, mis. PSQL-0080 (2-6 huruf kapital + strip + min. 2 digit)
export const QL_REGEX = /^[A-Z]{2,6}-\d{2,}$/;

// Label tahap pipeline di sistem Project Management
export const PM_STAGE_LABELS = {
  'leads-masuk': 'Leads Masuk',
  'proses-ql': 'Proses QL',
  'deal-running': 'Deal (Running)',
  'finish-penagihan': 'Finish Penagihan',
  'done-full-payment': 'Done Full Payment',
  'tidak-deal': 'Tidak Deal',
};
