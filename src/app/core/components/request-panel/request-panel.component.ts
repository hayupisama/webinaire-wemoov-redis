import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { RequestLoggerService } from '../../services/request-logger.service';

// Filtres extraits du DEMO.md — alignés sur les filtres Chrome de chaque démo
const FEATURE_FILTERS: Record<string, { include?: string[]; exclude?: string[] }> = {
  gateway:        { exclude: ['/health', '/api/routes'] },
  'rate-limiting':{ include: ['/api/rate/hit'] },
  streams:        { include: ['/api/publish'] },
  locks:          { include: ['/api/debit/concurrent', '/api/concert/book', '/api/concert/release', '/api/concert/reset'] },
  geo:            { include: ['/api/geo/search'] },
  ttl:            { exclude: ['/health'] },
};

@Component({
  selector: 'app-request-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (isEnabled()) {
      <!-- Floating Button -->
      <button
        (click)="togglePanel()"
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border shadow-xl transition-all"
        [class.border-[var(--accent)]]="isOpen()"
        [class.border-[var(--border-main)]]="!isOpen()"
        title="Inspecteur HTTP (Ctrl+H pour masquer)"
      >
        <mat-icon class="scale-90" [class.text-[var(--accent)]]="true">terminal</mat-icon>
        @if (featureLogs().length > 0) {
          <span class="text-xs font-mono font-bold text-white bg-[var(--accent)] rounded-md px-1.5 py-0.5 min-w-[20px] text-center leading-none">
            {{ featureLogs().length }}
          </span>
        } @else {
          <span class="text-xs text-[var(--text-secondary)] font-mono">HTTP</span>
        }
      </button>

      <!-- Backdrop -->
      @if (isOpen()) {
        <div
          class="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
          (click)="closePanel()"
        ></div>
      }

      <!-- Side Panel (droite) -->
      <div
        class="fixed top-0 right-0 h-screen w-[420px] z-40 flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-main)] shadow-2xl transition-transform duration-300 ease-in-out"
        [class.translate-x-0]="isOpen()"
        [class.translate-x-full]="!isOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-main)] shrink-0">
          <div class="flex items-center gap-2">
            <mat-icon class="text-[var(--accent)] scale-90">terminal</mat-icon>
            <span class="font-semibold text-white text-sm">Requêtes HTTP</span>
            <span class="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-main)] px-2 py-0.5 rounded-md">
              /{{ currentFeature() }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <!-- Toggle filtre -->
            <button
              (click)="toggleFilter()"
              class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
              [class.text-[var(--accent)]]="filterEnabled()"
              [class.bg-[var(--accent)]/10]="filterEnabled()"
              [class.text-[var(--text-secondary)]]="!filterEnabled()"
              [class.hover:bg-white/10]="!filterEnabled()"
              [title]="filterEnabled() ? 'Filtre démo actif — cliquer pour tout afficher' : 'Filtre désactivé — cliquer pour activer'"
            >
              <mat-icon class="scale-[0.65]">{{ filterEnabled() ? 'filter_alt' : 'filter_alt_off' }}</mat-icon>
              <span class="font-mono">filtre</span>
            </button>
            @if (featureLogs().length > 0) {
              <button
                (click)="clearLogs()"
                class="text-xs text-[var(--text-secondary)] hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
              >
                Effacer
              </button>
            }
            <button
              (click)="closePanel()"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all text-[var(--text-secondary)] hover:text-white"
            >
              <mat-icon class="scale-75">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Filter info bar -->
        @if (filterEnabled() && activeFilterDescription()) {
          <div class="px-4 py-1.5 bg-[var(--accent)]/5 border-b border-[var(--border-main)] flex items-center gap-2 shrink-0">
            <mat-icon class="scale-[0.6] text-[var(--accent)] shrink-0">info</mat-icon>
            <span class="text-[10px] text-[var(--text-secondary)] font-mono truncate">{{ activeFilterDescription() }}</span>
          </div>
        }

        <!-- Log List -->
        <div class="flex-1 overflow-y-auto">
          @if (featureLogs().length === 0) {
            <div class="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
              <mat-icon class="scale-150 opacity-30">wifi_off</mat-icon>
              <p class="text-sm">Aucune requête capturée</p>
              <p class="text-xs opacity-60 text-center px-8">Interagissez avec la démo pour voir les appels HTTP</p>
            </div>
          } @else {
            <div class="divide-y divide-[var(--border-main)]">
              @for (log of featureLogs(); track log.id) {
                <div
                  class="px-3 py-2.5 cursor-pointer transition-colors border-l-[3px]"
                  [class]="rowClass(log.status)"
                  (click)="toggleBody(log.id)"
                >
                  <!-- Row 1: method + url + status -->
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
                      [class]="methodClass(log.method)"
                    >{{ log.method }}</span>
                    <span class="text-xs font-mono text-white truncate flex-1 min-w-0" [title]="log.url">
                      {{ shortPath(log.url) }}
                    </span>
                    <span
                      class="shrink-0 text-[11px] font-black font-mono px-2 py-0.5 rounded-md"
                      [class]="statusBadgeClass(log.status)"
                    >{{ log.status }}</span>
                  </div>
                  <!-- Row 2: port + duration + time -->
                  <div class="flex items-center gap-3 mt-1">
                    <span class="text-[10px] text-[var(--text-secondary)] font-mono">
                      :{{ hostPort(log.url) }}
                    </span>
                    <span class="text-[10px] font-mono" [class]="durationClass(log.duration)">
                      {{ log.duration }}ms
                    </span>
                    <span class="text-[10px] text-[var(--text-secondary)] font-mono ml-auto">
                      {{ formatTime(log.timestamp) }}
                    </span>
                  </div>
                  <!-- Body (expandable) -->
                  @if (expandedIds().has(log.id) && log.body != null) {
                    <pre class="mt-2 text-[10px] font-mono bg-black/30 rounded-lg p-2 overflow-x-auto text-green-300 max-h-48 overflow-y-auto border border-white/10">{{ formatBody(log.body) }}</pre>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="shrink-0 px-4 py-2 border-t border-[var(--border-main)] flex items-center justify-between">
          <span class="text-[10px] text-[var(--text-secondary)] font-mono">
            {{ featureLogs().length }} requête{{ featureLogs().length !== 1 ? 's' : '' }}
          </span>
          <div class="flex items-center gap-3">
            @if (featureLogs().length > 0) {
              <span class="text-[10px] text-[var(--text-secondary)] font-mono">
                moy. {{ avgDuration() }}ms
              </span>
            }
            <span class="text-[10px] text-[var(--text-secondary)]/50 font-mono">Ctrl+H</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class RequestPanelComponent {
  private router = inject(Router);
  private loggerService = inject(RequestLoggerService);

  /** Masqué par défaut — activer avec Ctrl+H */
  isEnabled = signal(false);
  isOpen = signal(false);
  filterEnabled = signal(true);
  expandedIds = signal<Set<string>>(new Set());

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'h') {
      event.preventDefault();
      this.isEnabled.update(v => {
        if (v && this.isOpen()) this.isOpen.set(false);
        return !v;
      });
    }
  }

  currentFeature = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.split('/').filter(Boolean)[0] || ''),
      startWith(this.router.url.split('/').filter(Boolean)[0] || '')
    ),
    { initialValue: '' }
  );

  private allFeatureLogs = computed(() => {
    const feature = this.currentFeature();
    return this.loggerService.logs().filter(l => l.feature === feature);
  });

  featureLogs = computed(() => {
    const logs = this.allFeatureLogs();
    if (!this.filterEnabled()) return logs;

    const config = FEATURE_FILTERS[this.currentFeature()];
    if (!config) return logs;

    return logs.filter(log => {
      const path = this.shortPath(log.url);
      if (config.include) return config.include.some(p => path.includes(p));
      if (config.exclude) return !config.exclude.some(p => path.includes(p));
      return true;
    });
  });

  avgDuration = computed(() => {
    const logs = this.featureLogs();
    if (logs.length === 0) return 0;
    return Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length);
  });

  activeFilterDescription = computed(() => {
    const config = FEATURE_FILTERS[this.currentFeature()];
    if (!config) return '';
    if (config.include) return `Filtre : uniquement ${config.include.join(', ')}`;
    if (config.exclude) return `Filtre : masque ${config.exclude.join(', ')}`;
    return '';
  });

  togglePanel(): void { this.isOpen.update(v => !v); }
  closePanel(): void { this.isOpen.set(false); }
  toggleFilter(): void { this.filterEnabled.update(v => !v); }

  clearLogs(): void {
    this.loggerService.clearFeature(this.currentFeature());
    this.expandedIds.set(new Set());
  }

  toggleBody(id: string): void {
    this.expandedIds.update(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  shortPath(url: string): string {
    try { return new URL(url).pathname || url; } catch { return url; }
  }

  hostPort(url: string): string {
    try { return new URL(url).port || '80'; } catch { return ''; }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatBody(body: unknown): string {
    if (typeof body === 'string') return body;
    try { return JSON.stringify(body, null, 2); } catch { return String(body); }
  }

  rowClass(status: number): string {
    if (status >= 500) return 'bg-red-500/10 border-l-red-500 hover:bg-red-500/20';
    if (status === 429) return 'bg-orange-500/10 border-l-orange-400 hover:bg-orange-500/20';
    if (status >= 400) return 'bg-yellow-500/10 border-l-yellow-400 hover:bg-yellow-500/20';
    if (status >= 200 && status < 300) return 'bg-green-500/[0.07] border-l-green-500 hover:bg-green-500/15';
    return 'bg-white/5 border-l-white/20 hover:bg-white/10';
  }

  statusBadgeClass(status: number): string {
    if (status >= 500) return 'bg-red-500/30 text-red-300 ring-1 ring-red-500/50';
    if (status === 429) return 'bg-orange-500/30 text-orange-200 ring-1 ring-orange-400/50';
    if (status >= 400) return 'bg-yellow-500/30 text-yellow-200 ring-1 ring-yellow-400/50';
    if (status >= 200 && status < 300) return 'bg-green-500/25 text-green-300 ring-1 ring-green-500/40';
    return 'bg-gray-500/20 text-gray-300';
  }

  methodClass(method: string): string {
    const classes: Record<string, string> = {
      GET:    'bg-blue-500/20 text-blue-300',
      POST:   'bg-green-500/20 text-green-300',
      PUT:    'bg-orange-500/20 text-orange-300',
      PATCH:  'bg-yellow-500/20 text-yellow-300',
      DELETE: 'bg-red-500/20 text-red-300',
    };
    return classes[method] ?? 'bg-gray-500/20 text-gray-300';
  }

  durationClass(ms: number): string {
    if (ms > 500) return 'text-red-400';
    if (ms > 200) return 'text-orange-400';
    if (ms > 100) return 'text-yellow-400';
    return 'text-green-400';
  }
}
