import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
}

/**
 * State only — the visual toast is a shared/ui component (Part 3) that reads `current()`.
 * error.interceptor.ts pushes here on a 5xx; never surfaces the raw response body.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly current = signal<Toast | null>(null);

  show(message: string): void {
    this.current.set({ id: ++this.nextId, message });
  }

  dismiss(): void {
    this.current.set(null);
  }
}
