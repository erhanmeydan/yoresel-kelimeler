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

  // Email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({ field: 'email', message: 'Geçersiz e-posta.' });
  }

  // Password: stronger (10+ chars, mixed case, digit OR symbol)
  if (input.password.length < VALIDATION.PASSWORD_MIN) {
    errors.push({ field: 'password', message: `Şifre en az ${VALIDATION.PASSWORD_MIN} karakter.` });
  } else if (
    !/[A-ZÇĞİÖŞÜ]/.test(input.password) ||
    !/[a-zçğıöşü]/.test(input.password) ||
    !/[\d\W]/.test(input.password)
  ) {
    errors.push({ field: 'password', message: 'Şifre büyük/küçük harf ve rakam/işaret içermeli.' });
  }

  // Display name: trimmed length + max length + control char check
  const trimmedName = input.displayName.trim();
  if (trimmedName.length < VALIDATION.DISPLAY_NAME_MIN) {
    errors.push({ field: 'displayName', message: `Ad en az ${VALIDATION.DISPLAY_NAME_MIN} karakter.` });
  }
  if (trimmedName.length > VALIDATION.DISPLAY_NAME_MAX) {
    errors.push({ field: 'displayName', message: `Ad en fazla ${VALIDATION.DISPLAY_NAME_MAX} karakter.` });
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmedName)) {
    errors.push({ field: 'displayName', message: 'Ad geçersiz karakter içeriyor.' });
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}