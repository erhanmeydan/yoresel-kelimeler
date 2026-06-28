import { VALIDATION } from '../config/constants';
import type { EntryType } from '../types/models';

export interface ValidationError { field: string; message: string; }
export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

export function validateEntry(input: {
  word: string; meaning: string; exampleSentence: string; type: EntryType; regionId: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.word.trim()) errors.push({ field: 'word', message: 'Kelime gerekli.' });
  else if (input.word.length > VALIDATION.WORD_MAX) errors.push({ field: 'word', message: `Maksimum ${VALIDATION.WORD_MAX} karakter.` });

  if (!input.meaning.trim()) errors.push({ field: 'meaning', message: 'Anlam gerekli.' });
  else if (input.meaning.length > VALIDATION.MEANING_MAX) errors.push({ field: 'meaning', message: `Maksimum ${VALIDATION.MEANING_MAX} karakter.` });

  if (input.exampleSentence.length > VALIDATION.EXAMPLE_MAX) errors.push({ field: 'exampleSentence', message: `Maksimum ${VALIDATION.EXAMPLE_MAX} karakter.` });

  if (!input.regionId) errors.push({ field: 'regionId', message: 'İl seçilmeli.' });
  if (!['kelime', 'deyim', 'atasözü'].includes(input.type)) errors.push({ field: 'type', message: 'Geçerli bir tür seçin.' });

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateRegister(input: { email: string; password: string; displayName: string }): ValidationResult {
  const errors: ValidationError[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push({ field: 'email', message: 'Geçersiz e-posta.' });
  if (input.password.length < 6) errors.push({ field: 'password', message: 'Şifre en az 6 karakter.' });
  if (input.displayName.trim().length < 2) errors.push({ field: 'displayName', message: 'Ad en az 2 karakter.' });
  return errors.length ? { ok: false, errors } : { ok: true };
}
