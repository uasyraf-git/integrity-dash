export interface PauseHandlers {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export class PauseScreen {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.getElementById('screen-pause') as HTMLElement;
  }

  bind(handlers: PauseHandlers): void {
    document.getElementById('btn-resume')?.addEventListener('click', handlers.onResume);
    document
      .getElementById('btn-restart-from-pause')
      ?.addEventListener('click', handlers.onRestart);
    document.getElementById('btn-menu-from-pause')?.addEventListener('click', handlers.onMainMenu);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
