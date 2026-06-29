import { renderEntryForm } from '../components/EntryForm';

export async function renderContributePage(
  container: HTMLElement, entryId?: string,
): Promise<void> {
  const wrap = document.createElement('div');
  wrap.className = 'page-container';
  container.replaceChildren(wrap);

  await renderEntryForm(wrap, entryId ? { entryId } : {});
}