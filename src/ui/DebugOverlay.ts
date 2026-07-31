/**
 * Optional development-only overlay showing the Adaptive Difficulty Director's live state,
 * current modifiers, evaluation timer, and a Run Analytics summary. Disabled by default and
 * never created at all unless the page is loaded with `?debug=1` in the URL (mirroring the
 * `?quality=` override pattern from Sprint 3B) - it never appears in normal play, and produces
 * no console output at all (a single DOM textContent write, not console spam).
 */
export class DebugOverlay {
  private readonly enabled: boolean;
  private readonly element: HTMLElement | null = null;

  constructor() {
    this.enabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';

    if (!this.enabled) return;

    const element = document.createElement('div');
    element.id = 'debug-overlay';
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = [
      'position: fixed',
      'bottom: 8px',
      'left: 8px',
      'z-index: 9999',
      'padding: 8px 10px',
      'background: rgba(0, 0, 0, 0.72)',
      'color: #7CFC7C',
      'font: 11px/1.5 monospace',
      'white-space: pre',
      'pointer-events: none',
      'border-radius: 6px',
      'max-width: 320px',
    ].join(';');
    document.body.appendChild(element);
    this.element = element;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setText(text: string): void {
    if (!this.enabled || !this.element) return;
    this.element.textContent = text;
  }
}
