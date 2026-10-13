import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/** Toast state; shared/ui/toast renders `current()` in a polite live region. Never shows a raw error body. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly current = signal<Toast | null>(null);

  show(message: string, tone: Toast['tone'] = 'info'): void {
    this.current.set({ id: ++this.nextId, message, tone });
  }

  dismiss(): void {
    this.current.set(null);
  }
}
