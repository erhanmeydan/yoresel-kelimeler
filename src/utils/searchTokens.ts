/**
 * Search token üretir — entry'nin word + meaning + exampleSentence alanlarından.
 * - Türkçe lower-case (tr-TR)
 * - Noktalama ve control char'lar temizlenir
 * - Her kelime + her prefix (2-4 karakter) token olarak eklenir
 * - Toplam 50 token ile sınırlı (Firestore array-contains-any sınırı)
 *
 * Hem client (backfill script) hem server (Cloud Function) tarafından kullanılır.
 */
export function computeSearchTokens(
  word: string,
  meaning: string,
  exampleSentence = '',
): string[] {
  const text = [word, meaning, exampleSentence].join(' ');
  const normalized = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = new Set<string>();
  for (const w of normalized.split(' ')) {
    if (w.length < 2) continue;
    tokens.add(w);
    for (let i = 2; i <= Math.min(4, w.length); i++) {
      tokens.add(w.slice(0, i));
    }
  }

  return Array.from(tokens).slice(0, 50);
}