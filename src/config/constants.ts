export const COLLECTIONS = {
  REGIONS: 'regions',
  USERS: 'users',
  ENTRIES: 'entries',
  REPORTS: 'reports',
  MODERATION_LOG: 'moderationLog',
  COMMENTS: 'comments',
  REGION_STATS: 'regionStats',
} as const;

export const TURKISH_PARENT_REGIONS = [
  'Marmara',
  'Ege',
  'Akdeniz',
  'Karadeniz',
  'İç Anadolu',
  'Doğu Anadolu',
  'Güneydoğu Anadolu',
] as const;

export const ENTRY_TYPE_LABELS: Record<'kelime' | 'deyim' | 'atasözü', string> = {
  kelime: 'Kelime',
  deyim: 'Deyim',
  atasözü: 'Atasözü',
};

export const VALIDATION = {
  WORD_MAX: 100,
  MEANING_MAX: 500,
  EXAMPLE_MAX: 500,
  REASON_MAX: 200,
  ENTRIES_PER_MINUTE: 5,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 40,
  PASSWORD_MIN: 10,
} as const;