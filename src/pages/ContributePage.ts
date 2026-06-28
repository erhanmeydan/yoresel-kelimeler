import { renderEntryForm } from '../components/EntryForm';

export async function renderContributePage(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="page-container"></div>';
  await renderEntryForm(container.querySelector<HTMLDivElement>('.page-container')!);
}
