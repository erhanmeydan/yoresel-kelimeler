export function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export function sanitizeText(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}