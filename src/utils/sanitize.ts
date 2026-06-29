export function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Strip control characters and normalize whitespace.
 * Removes null bytes and C0/C1 control chars (except \n, \r, \t).
 * Does NOT escape HTML — display layer must use textContent for safety.
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return input
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Combined sanitize + HTML escape for safe inclusion in HTML strings.
 * Use this when building HTML via template literals — not for plain textContent.
 */
export function safeHtml(input: string): string {
  return escapeHtml(sanitizeText(input));
}