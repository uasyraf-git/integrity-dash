export interface MainMenuHandlers {
  onStart: () => void;
  onHowToPlay: () => void;
}

export class MainMenuScreen {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.getElementById('screen-menu') as HTMLElement;
  }

  bind(handlers: MainMenuHandlers): void {
    document.getElementById('btn-start')?.addEventListener('click', handlers.onStart);
    document.getElementById('btn-how-to-play')?.addEventListener('click', handlers.onHowToPlay);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
