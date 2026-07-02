// Lightweight modal confirm. Two shapes coexist for backwards compatibility:
// - `confirmAction(message)` — legacy string-message API used by existing tabs
//   that haven't migrated yet (UsersTab, ReportsTab).
// - `confirm(options)` — new Task 5/12 API with title + message + variant,
//   consumed by ListView-driven tabs (CommentsTab, future EntriesTab).

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
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

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-danger';
    okBtn.textContent = 'Onayla';

    actions.append(cancel, okBtn);
    modal.append(text, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const cleanup = (result: boolean) => {
      backdrop.remove();
      resolve(result);
    };

    cancel.addEventListener('click', () => cleanup(false));
    okBtn.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

export function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = `confirm-dialog confirm-dialog--${options.variant ?? 'default'}`;
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.setAttribute('aria-describedby', 'confirm-dialog-message');

    const title = document.createElement('h3');
    title.id = 'confirm-dialog-title';
    title.className = 'confirm-dialog__title';
    title.textContent = options.title;

    const message = document.createElement('p');
    message.id = 'confirm-dialog-message';
    message.className = 'confirm-dialog__message';
    message.textContent = options.message;

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary confirm-dialog__cancel';
    cancelBtn.textContent = options.cancelLabel ?? 'İptal';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn ${options.variant === 'danger' ? 'btn-danger' : 'btn-primary'} confirm-dialog__confirm`;
    confirmBtn.textContent = options.confirmLabel ?? 'Onayla';

    const close = (result: boolean) => {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
      resolve(result);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    document.addEventListener('keydown', handleKey);

    dialog.append(title, message, cancelBtn, confirmBtn);
    overlay.append(dialog);
    document.body.append(overlay);

    confirmBtn.focus();
  });
}