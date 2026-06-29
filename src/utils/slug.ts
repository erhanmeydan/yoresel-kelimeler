/**
 * Slug utility — Türkçe karakterlerden ASCII'ye transliteration + kebab-case.
 * URL-friendly, SEO için anahtar kelime bazlı.
 */

const TR_MAP: Record<string, string> = {
  ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G',
  ı: 'i', İ: 'I', ö: 'o', Ö: 'O',
  ü: 'u', Ü: 'U', ç: 'c', Ç: 'C',
};

export function slugify(text: string): string {
  const transliterated = text.replace(/[şŞğĞıİöÖüÜçÇ]/g, (c) => TR_MAP[c] ?? c);
  const lower = transliterated.toLocaleLowerCase('tr-TR');
  const cleaned = lower
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 80 ? cleaned.substring(0, 80).replace(/-+$/g, '') : cleaned || 'sozcuk';
}

export function generateUniqueSlug(text: string, existing: Set<string>): string {
  const base = slugify(text);
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}