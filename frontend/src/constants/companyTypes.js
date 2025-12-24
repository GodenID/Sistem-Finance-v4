// Company Types with Colors
export const COMPANY_TYPES_WITH_COLORS = {
  'Prasasti Selaras': {
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    darkColor: 'bg-blue-600',
  },
  'Mutiari Garden': {
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    darkColor: 'bg-emerald-600',
  },
  'Wood and Steel': {
    color: 'amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    darkColor: 'bg-amber-600',
  },
  'Mutiari Decoration': {
    color: 'purple',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    darkColor: 'bg-purple-600',
  },
  'Kebutuhan Kantor': {
    color: 'slate',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    badgeBg: 'bg-slate-100',
    darkColor: 'bg-slate-600',
  },
  'Kebutuhan Kebun': {
    color: 'lime',
    bgColor: 'bg-lime-50',
    textColor: 'text-lime-700',
    borderColor: 'border-lime-200',
    badgeBg: 'bg-lime-100',
    darkColor: 'bg-lime-600',
  },
  'Kebutuhan Toko': {
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    darkColor: 'bg-orange-600',
  },
};

// Company IDs with their details
export const COMPANY_IDS = [
  {
    id: 'PSS',
    fullName: 'Prasasti Selaras Sinergi',
    tipe: 'Prasasti Selaras',
  },
  {
    id: 'PS',
    fullName: 'CV Prasasti Selaras',
    tipe: 'Prasasti Selaras',
  },
  {
    id: 'MAW',
    fullName: 'PT Mutiari Adi Warna',
    tipe: 'Mutiari Garden',
  },
  {
    id: 'MGI',
    fullName: 'PT Mutiari Garden Indonesia',
    tipe: 'Mutiari Garden',
  },
  {
    id: 'PWS',
    fullName: 'PT Prasasti Widya Sejahtera',
    tipe: 'Wood and Steel',
  },
  {
    id: 'KK',
    fullName: 'Kebutuhan Kantor',
    tipe: 'Kebutuhan Kantor',
  },
  {
    id: 'KKB',
    fullName: 'Kebutuhan Kebun',
    tipe: 'Kebutuhan Kebun',
  },
  {
    id: 'KT',
    fullName: 'Kebutuhan Toko',
    tipe: 'Kebutuhan Toko',
  },
];

// Tipe Unit Bisnis options for dropdown
export const TIPE_OPTIONS = [
  { value: 'Prasasti Selaras', label: 'Prasasti Selaras' },
  { value: 'Mutiari Garden', label: 'Mutiari Garden' },
  { value: 'Wood and Steel', label: 'Wood and Steel' },
  { value: 'Mutiari Decoration', label: 'Mutiari Decoration' },
  { value: 'Kebutuhan Kantor', label: 'Kebutuhan Kantor' },
  { value: 'Kebutuhan Kebun', label: 'Kebutuhan Kebun' },
  { value: 'Kebutuhan Toko', label: 'Kebutuhan Toko' }
];

// ID Perusahaan options for dropdown (all options always visible)
export const ID_PERUSAHAAN_OPTIONS = COMPANY_IDS.map(company => ({
  value: company.id,
  label: `${company.id} - ${company.fullName}`,
  tipe: company.tipe
}));

// Helper to get colors by tipe
export const getColorsByTipe = (tipe) => {
  return COMPANY_TYPES_WITH_COLORS[tipe] || {
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    badgeBg: 'bg-gray-100',
    darkColor: 'bg-gray-600',
  };
};

// Helper to get company info by ID
export const getCompanyById = (id) => {
  return COMPANY_IDS.find(company => company.id === id);
};

// Helper to get IDs by tipe
export const getIdsByTipe = (tipe) => {
  return COMPANY_IDS.filter(company => company.tipe === tipe);
};
