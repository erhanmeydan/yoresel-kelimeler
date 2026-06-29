import { describe, it, expect } from 'vitest';
import { computeSearchTokens } from '../../src/utils/searchTokens';

describe('computeSearchTokens', () => {
  it('tek kelime için tam kelime + 2-4 prefix üretir', () => {
    const tokens = computeSearchTokens('anane', '', '');
    expect(tokens).toContain('anane');
    expect(tokens).toContain('an');
    expect(tokens).toContain('ana');
    expect(tokens).toContain('anan');
  });

  it('5 harfli kelimede token sayısı 4 olur (1 tam + 3 prefix)', () => {
    const tokens = computeSearchTokens('anane', '', '');
    expect(tokens).toHaveLength(4);
  });

  it('2 harfli kelimede sadece tam kelime üretilir', () => {
    const tokens = computeSearchTokens('ab', '', '');
    expect(tokens).toEqual(['ab']);
  });

  it('Türkçe karakterleri korur ve tr-TR lower-case uygular', () => {
    const tokens = computeSearchTokens('küşleme', 'Izgara et yemeği', '');
    expect(tokens).toContain('küşleme');
    expect(tokens).toContain('küş');
    // I (Türkçe büyük ı değil, noktasız I) → 'ı' olmalı
    expect(tokens).toContain('ızgara');
  });

  it('noktalama işaretlerini temizler', () => {
    const tokens = computeSearchTokens('akşam', 'Akşam yemeği, dedenin sofrası.', '');
    // Virgül noktalama olarak temizlenmeli, "akşam" kelimesi token olarak kalmalı
    expect(tokens).toContain('akşam');
    expect(tokens).toContain('yemeği');
    // Yapışık noktalama olmamalı
    expect(tokens.find((t) => t.includes(','))).toBeUndefined();
    expect(tokens.find((t) => t.includes('.'))).toBeUndefined();
  });

  it('çok kelimeli anlam için tüm kelimelerin tokenlarını üretir', () => {
    const tokens = computeSearchTokens('uyku tutmamak', 'Uyuyamamak, uykusuz kalmak', 'Heyecandan uyku tutmadı.');
    expect(tokens).toContain('uyku');
    expect(tokens).toContain('tutmamak');
    expect(tokens).toContain('uyuyamamak');
    expect(tokens).toContain('uykusuz');
    expect(tokens).toContain('kalmak');
    expect(tokens).toContain('heyecandan');
  });

  it('exampleSentence parametresi de token üretimine katılır', () => {
    const withExample = computeSearchTokens('kelime', 'anlam', 'örnek cümle');
    expect(withExample).toContain('örnek');
    expect(withExample).toContain('cümle');
  });

  it('tek harfli kelimeleri yok sayar', () => {
    const tokens = computeSearchTokens('a b', 'o ile', '');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('o');
    // 'ile' 2 harf → eklensin
    expect(tokens).toContain('ile');
  });

  it('50 token sınırını aşmaz', () => {
    // 60 farklı kelime → 60 + prefixler → 200+ token üretilir
    const manyWords = Array.from({ length: 60 }, (_, i) => `kelime${i}`).join(' ');
    const tokens = computeSearchTokens(manyWords, '', '');
    expect(tokens.length).toBeLessThanOrEqual(50);
  });

  it('boş input için boş dizi döner', () => {
    expect(computeSearchTokens('', '', '')).toEqual([]);
  });

  it('boşluk ve tab gibi whitespace tek boşluk olarak normalize edilir', () => {
    const tokens = computeSearchTokens('anane', 'bir   iki\tüç', '');
    expect(tokens).toContain('bir');
    expect(tokens).toContain('iki');
    expect(tokens).toContain('üç');
  });
});