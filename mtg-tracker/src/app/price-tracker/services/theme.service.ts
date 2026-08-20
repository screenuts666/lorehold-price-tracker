// ============================================================================
// THEME SERVICE - DUAL THEME ENGINE (DARK OBSIDIAN & LIGHT STUDIO)
// ============================================================================

import { Injectable, signal, computed } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'lorehold_app_theme';

  public currentTheme = signal<AppTheme>('dark');
  public isLight = computed(() => this.currentTheme() === 'light');

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
    if (saved === 'dark' || saved === 'light') {
      this.setTheme(saved);
    } else {
      this.setTheme('dark');
    }
  }

  public setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const body = document.body;

      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        root.classList.add('light-theme');
        body.classList.add('light-theme');
      } else {
        root.setAttribute('data-theme', 'dark');
        root.classList.remove('light-theme');
        body.classList.remove('light-theme');
      }
    }
  }

  public toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }
}
