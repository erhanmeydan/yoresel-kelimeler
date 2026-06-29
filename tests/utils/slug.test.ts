import { describe, it, expect } from 'vitest';
import { slugify, generateUniqueSlug } from '../../src/utils/slug';

describe('slugify', () => {
  it('Türkçe karakterleri ASCII karşılığına çevirir', () => {
    expect(slugify('küşleme')).toBe('kusleme');
    expect(slugify('Gönlü kalmak')).toBe('gonlu-kalmak');
    expect(slugify('Çam sakızı')).toBe('cam-sakizi');
    expect(slugify('öğrenci')).toBe('ogrenci');
    expect(slugify('ışık')).toBe('isik');
  });

  it('boşluk ve özel karakterleri dash yapar', () => {
    expect(slugify('Çam sakızı, çoban armağanı')).toBe('cam-sakizi-coban-armagani');
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('çoklu boşluk ve dash normalize eder', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
    expect(slugify('a---b')).toBe('a-b');
    expect(slugify('  a b  ')).toBe('a-b');
  });

  it('sadece özel karakter → fallback', () => {
    expect(slugify('!!!@@@')).toBe('sozcuk');
    expect(slugify('')).toBe('sozcuk');
    expect(slugify('123')).toBe('123');
  });

  it('80 karakter ile sınırlar', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it('büyük harf → küçük harf', () => {
    expect(slugify('HELLO')).toBe('hello');
    expect(slugify('HelloWorld')).toBe('helloworld');
  });
});

describe('generateUniqueSlug', () => {
  it('ilk önerilen slug uygunsa onu döner', () => {
    const existing = new Set<string>();
    expect(generateUniqueSlug('küşleme', existing)).toBe('kusleme');
  });

  it('duplicate varsa -2 ekler', () => {
    const existing = new Set<string>(['kusleme']);
    expect(generateUniqueSlug('küşleme', existing)).toBe('kusleme-2');
  });

  it('ardışık duplicate → -3, -4', () => {
    const existing = new Set<string>(['kusleme', 'kusleme-2']);
    expect(generateUniqueSlug('küşleme', existing)).toBe('kusleme-3');
  });

  it('boş input → fallback sozcuk + suffix', () => {
    const existing = new Set<string>(['sozcuk']);
    expect(generateUniqueSlug('', existing)).toBe('sozcuk-2');
  });
});