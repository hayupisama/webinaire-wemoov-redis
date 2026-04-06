import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, DatePipe } from '@angular/common';
import { RateLimitService } from './rate-limit.service';
import { interval, switchMap, forkJoin, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-rate-limiting',
  standalone: true,
  imports: [MatIconModule, NgClass, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-6">
        <h2 class="text-3xl font-heading font-bold text-white">Rate Limiting</h2>
        <p class="text-[var(--text-secondary)] mt-2">Comparaison des limites de requêtes en environnement multi-instances.</p>
      </div>

      <div class="grid grid-cols-2 gap-8 flex-1 min-h-0">
        
        <!-- COLONNE GAUCHE : Sans Redis -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <h3 class="font-heading font-semibold text-lg">Multi-instances désynchronisées</h3>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                Sans Redis
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
            
            <div class="grid grid-cols-1 gap-4">
              @for (instance of instances; track instance) {
                <div class="bg-black/20 border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden"
                     [ngClass]="{'border-[var(--accent)]/50 bg-[var(--accent)]/5': instances[roundRobinIndex()] === instance}">
                  
                  @if (instances[roundRobinIndex()] === instance) {
                    <div class="absolute top-0 right-0 px-2 py-0.5 bg-[var(--accent)] text-white text-[9px] font-bold uppercase rounded-bl-lg">
                      Prochaine cible
                    </div>
                  }

                  <div class="flex justify-between items-center">
                    <span class="text-sm font-medium text-[var(--text-secondary)]">Instance {{instance}}</span>
                    <span class="text-xl font-bold" [ngClass]="getProgressColor(countersNoRedis()[instance], 10).text">
                      {{ countersNoRedis()[instance] || 0 }}<span class="text-sm text-[var(--text-secondary)]">/10</span>
                    </span>
                  </div>
                  <!-- Progress bar -->
                  <div class="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div class="h-full transition-all duration-300"
                         [style.width.%]="Math.min(((countersNoRedis()[instance] || 0) / 10) * 100, 100)"
                         [ngClass]="getProgressColor(countersNoRedis()[instance], 10).bg">
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="flex flex-col gap-4 mt-auto pt-6 border-t border-[var(--border-main)]">
              <div class="p-4 rounded-xl border flex justify-between items-center transition-colors duration-300"
                   [ngClass]="totalNoRedis() > 10 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-black/20 border-[var(--border-main)]'">
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Total global</span>
                  <span class="text-xs text-[var(--accent)]">Quota voulu : 10 req</span>
                </div>
                <span class="text-2xl font-bold" [ngClass]="totalNoRedis() > 10 ? 'text-rose-400' : 'text-white'">
                  {{ totalNoRedis() }}
                </span>
              </div>

              <div class="flex gap-3">
                <button (click)="toggleNoRedis()"
                        class="flex-1 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md"
                        [ngClass]="isRunningNoRedis() ? 'bg-[var(--accent)] text-white hover:bg-[#d94a3a]' : 'bg-white text-slate-900 hover:bg-gray-200'">
                  @if (isRunningNoRedis()) {
                    <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    Arrêter le tir
                  } @else {
                    <mat-icon class="text-[var(--accent)]">play_circle</mat-icon>
                    Démarrer le tir
                  }
                </button>
                <button (click)="resetNoRedis()" class="px-4 py-3 bg-black/40 hover:bg-black/60 border border-[var(--border-main)] text-white rounded-xl transition-colors flex items-center justify-center">
                  <mat-icon>refresh</mat-icon>
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- COLONNE DROITE : Avec Redis -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border transition-colors duration-300 flex flex-col overflow-hidden relative"
             [ngClass]="isFlashing() ? 'border-rose-500 bg-rose-500/5' : 'border-[var(--border-main)]'">
          <!-- Subtle Glow -->
          <div class="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] pointer-events-none"></div>

          <!-- Header -->
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20 relative z-10">
            <div class="flex items-center gap-3">
              <h3 class="font-heading font-semibold text-lg">Compteur Global Atomique</h3>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                Avec Redis
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-6 relative z-10">
            
            <!-- Main Counter -->
            <div class="flex flex-col items-center justify-center py-8 gap-4 bg-black/20 rounded-xl border border-[var(--border-main)]">
              <div class="text-6xl font-bold font-mono" [ngClass]="getProgressColor(counterRedis(), 10).text">
                {{ counterRedis() }}<span class="text-2xl text-[var(--text-secondary)]">/10</span>
              </div>
              <div class="w-full max-w-xs h-3 bg-black/40 rounded-full overflow-hidden mt-2">
                <div class="h-full transition-all duration-300"
                     [style.width.%]="Math.min((counterRedis() / 10) * 100, 100)"
                     [ngClass]="getProgressColor(counterRedis(), 10).bg">
                </div>
              </div>
              
              <div class="h-8 mt-4">
                @if (lastStatusRedis() === 429) {
                  <span class="px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-medium flex items-center gap-2">
                    <mat-icon class="text-[16px] w-[16px] h-[16px]">block</mat-icon> HTTP 429 — Quota dépassé
                  </span>
                } @else if (lastStatusRedis() === 200) {
                  <span class="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium flex items-center gap-2">
                    <mat-icon class="text-[16px] w-[16px] h-[16px]">check_circle</mat-icon> HTTP 200 — OK
                  </span>
                }
              </div>
            </div>

            <!-- History -->
            <div class="flex-1 flex flex-col gap-3 min-h-[150px]">
              <h4 class="text-sm font-medium text-[var(--text-secondary)]">Historique récent (10 derniers)</h4>
              <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                @for (item of historyRedis(); track item.time) {
                  <div class="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <span class="text-[var(--text-secondary)] font-mono">{{ item.time | date:'HH:mm:ss.SSS' }}</span>
                    <span [ngClass]="item.status === 200 ? 'text-emerald-400' : 'text-rose-400'" class="font-bold flex items-center gap-1">
                      HTTP {{ item.status }}
                      <mat-icon class="text-[14px] w-[14px] h-[14px]">{{ item.status === 200 ? 'check' : 'close' }}</mat-icon>
                    </span>
                  </div>
                }
                @if (historyRedis().length === 0) {
                  <div class="text-center p-4 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                    Aucune requête envoyée
                  </div>
                }
              </div>
            </div>

            <div class="flex gap-3 mt-auto pt-6 border-t border-[var(--border-main)]">
              <button (click)="toggleRedis()"
                      class="flex-1 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md"
                      [ngClass]="isRunningRedis() ? 'bg-[var(--primary)] text-white hover:bg-[#5068b0]' : 'bg-white text-slate-900 hover:bg-gray-200'">
                @if (isRunningRedis()) {
                  <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  Arrêter le tir
                } @else {
                  <mat-icon class="text-[var(--primary)]">play_circle</mat-icon>
                  Démarrer le tir
                }
              </button>
              <button (click)="resetRedis()" class="px-4 py-3 bg-black/40 hover:bg-black/60 border border-[var(--border-main)] text-white rounded-xl transition-colors flex items-center justify-center">
                <mat-icon>refresh</mat-icon>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  `
})
export class RateLimitingComponent {
  private rateLimitService = inject(RateLimitService);
  Math = Math;

  instances = ['A', 'B', 'C'];
  
  // State No Redis
  countersNoRedis = signal<Record<string, number>>({ A: 0, B: 0, C: 0 });
  roundRobinIndex = signal(0);

  // State Redis
  counterRedis = signal(0);
  historyRedis = signal<{status: number, time: Date}[]>([]);
  isFlashing = signal(false);
  lastStatusRedis = signal<number | null>(null);

  isRunningNoRedis = signal(false);
  isRunningRedis = signal(false);
  private readonly FIRE_INTERVAL_MS = 300;

  // Computed
  totalNoRedis = computed(() => {
    const counters = this.countersNoRedis();
    return (counters['A'] || 0) + (counters['B'] || 0) + (counters['C'] || 0);
  });

  constructor() {
    // Polling
    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => forkJoin({
        A: this.rateLimitService.getCounterNoRedis('A'),
        B: this.rateLimitService.getCounterNoRedis('B'),
        C: this.rateLimitService.getCounterNoRedis('C'),
        redis: this.rateLimitService.getCounterRedis()
      }))
    ).subscribe(res => {
      this.countersNoRedis.set({ A: res.A, B: res.B, C: res.C });
      this.counterRedis.set(res.redis);
    });

    // Tir automatique No Redis (round-robin)
    interval(this.FIRE_INTERVAL_MS).pipe(
      takeUntilDestroyed(),
      filter(() => this.isRunningNoRedis())
    ).subscribe(() => this.hitNoRedis());

    // Tir automatique Redis
    interval(this.FIRE_INTERVAL_MS).pipe(
      takeUntilDestroyed(),
      filter(() => this.isRunningRedis())
    ).subscribe(() => this.hitRedis());
  }

  toggleNoRedis() {
    this.isRunningNoRedis.update(v => !v);
  }

  toggleRedis() {
    this.isRunningRedis.update(v => !v);
  }

  getProgressColor(val = 0, max: number): { bg: string, text: string } {
    const ratio = val / max;
    if (ratio < 0.5) return { bg: 'bg-emerald-500', text: 'text-emerald-400' };
    if (ratio < 0.8) return { bg: 'bg-orange-500', text: 'text-orange-400' };
    return { bg: 'bg-rose-500', text: 'text-rose-400' };
  }

  hitNoRedis() {
    const currentInstance = this.instances[this.roundRobinIndex()];
    this.roundRobinIndex.update(i => (i + 1) % this.instances.length);
    
    // Optimistic update for better UX
    this.countersNoRedis.update(counters => ({
      ...counters,
      [currentInstance]: (counters[currentInstance] || 0) + 1
    }));

    this.rateLimitService.hitNoRedis(currentInstance).subscribe();
  }

  resetNoRedis() {
    this.isRunningNoRedis.set(false);
    this.rateLimitService.resetNoRedis().subscribe(() => {
      this.countersNoRedis.set({ A: 0, B: 0, C: 0 });
      this.roundRobinIndex.set(0);
    });
  }

  hitRedis() {
    this.rateLimitService.hitRedis().subscribe(status => {
      this.lastStatusRedis.set(status);
      
      this.historyRedis.update(history => {
        const newHistory = [{ status, time: new Date() }, ...history];
        return newHistory.slice(0, 10); // Keep last 10
      });

      if (status === 429) {
        this.isFlashing.set(true);
        setTimeout(() => this.isFlashing.set(false), 2000);
      } else {
        // Optimistic update
        this.counterRedis.update(v => v + 1);
      }
    });
  }

  resetRedis() {
    this.isRunningRedis.set(false);
    this.rateLimitService.resetRedis().subscribe(() => {
      this.counterRedis.set(0);
      this.historyRedis.set([]);
      this.lastStatusRedis.set(null);
      this.isFlashing.set(false);
    });
  }
}
