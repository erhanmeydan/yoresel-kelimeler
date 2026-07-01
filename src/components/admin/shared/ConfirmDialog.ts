export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Lightweight modal — no innerHTML with user data
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const text = document.createElement('p');
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-secondary';
    cancel.textContent = 'İptal';

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-danger';
    confirm.textContent = 'Onayla';

    actions.append(cancel, confirm);
    modal.append(text, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const cleanup = (result: boolean) => {
      backdrop.remove();
      resolve(result);
    };

    cancel.addEventListener('click', () => cleanup(false));
    confirm.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}
