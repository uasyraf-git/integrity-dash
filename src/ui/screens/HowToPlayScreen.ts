export interface HowToPlayHandlers {
  onBack: () => void;
}

export class HowToPlayScreen {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.getElementById('screen-how-to-play') as HTMLElement;
  }

  bind(handlers: HowToPlayHandlers): void {
    document
      .getElementById('btn-back-from-how-to-play')
      ?.addEventListener('click', handlers.onBack);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
