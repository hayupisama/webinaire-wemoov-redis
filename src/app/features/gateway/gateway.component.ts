import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GatewayService, HelloResponse, RouteDef } from './gateway.service';
import { interval, switchMap, filter, forkJoin, EMPTY } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { map } from 'rxjs/operators';

type AnimState = 'idle' | 'departing' | 'sending' | 'returning';

@Component({
  selector: 'app-gateway',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-6">
        <h2 class="text-3xl font-heading font-bold text-white">API Gateway Routing</h2>
        <p class="text-[var(--text-secondary)] mt-2">Comparaison du routage dynamique avec et sans Redis.</p>
      </div>

      <div class="grid grid-cols-2 gap-8 flex-1 min-h-0">

        <!-- COLONNE GAUCHE : Sans Redis -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <h3 class="font-heading font-semibold text-lg">Architecture Classique</h3>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                Sans Redis
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium" [ngClass]="healthNoRedis() ? 'text-emerald-400' : 'text-rose-400'">
              <div class="w-2 h-2 rounded-full" [ngClass]="healthNoRedis() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></div>
              {{ healthNoRedis() ? 'En ligne' : 'Hors ligne' }}
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-6">

            <!-- Info Box -->
            <div class="p-4 rounded-[var(--radius-inner)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex gap-3 text-[var(--accent)]">
              <mat-icon class="shrink-0">info</mat-icon>
              <div class="text-sm leading-relaxed">
                <strong>Pour modifier une route :</strong><br>
                Éditer <code class="bg-black/20 px-1 py-0.5 rounded">application.yml</code> puis redémarrer le service.
              </div>
            </div>

            <!-- Action & Animation -->
            <div class="flex flex-col gap-4">
              <!-- Animation Client/Server -->
              <div class="bg-black/20 rounded-xl border border-[var(--border-main)] p-3">
                <div class="flex items-stretch gap-2">
                  <!-- Angular icon (Client) -->
                  <div class="flex-shrink-0 w-10 flex flex-col items-center justify-center gap-1">
                    <div class="bg-[var(--bg-surface)] p-1.5 rounded-lg border border-[var(--border-main)] shadow-md">
                      <svg viewBox="0 0 250 250" class="w-5 h-5"><path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/><path fill="#C3002F" d="M125 30v22.2-.1V230l78.9-43.7 14.2-123.1L125 30z"/><path fill="#FFA3B1" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9 17 40.9z"/></svg>
                    </div>
                    <span class="text-[9px] text-[var(--text-secondary)]">Client</span>
                  </div>

                  <!-- Endpoint lanes -->
                  <div class="flex-1 flex flex-col gap-1.5 min-w-0">
                    @for (route of noRedisEndpoints(); track route.path) {
                      <div class="relative h-6 flex items-center overflow-hidden">
                        <div class="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border-main)]"></div>
                        <span class="relative z-10 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] px-1 rounded">{{ route.path }}</span>
                        @if (lastResNoRedis()[route.path]; as res) {
                          <span class="absolute right-0 z-10 text-[9px] font-mono bg-[var(--bg-surface)] px-1 rounded"
                                [ngClass]="res.error ? 'text-rose-400' : 'text-emerald-400'">
                            {{ res.error ? 'ERR' : res.durationMs + 'ms' }}
                          </span>
                        }
                        <!-- Ball -->
                        <div class="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ease-in-out"
                             [ngClass]="getBallClasses(animStatesNoRedis(), route.path)">
                          <div class="bg-[var(--accent)] text-white p-0.5 rounded-full shadow-[0_0_6px_var(--accent)] flex items-center justify-center">
                            <mat-icon class="text-[10px] w-[10px] h-[10px] leading-none">
                              {{ (animStatesNoRedis()[route.path] ?? 'idle') === 'returning' ? 'mark_email_read' : 'mail' }}
                            </mat-icon>
                          </div>
                        </div>
                      </div>
                    }
                    @if (noRedisEndpoints().length === 0) {
                      <div class="flex items-center justify-center h-8 text-[10px] text-[var(--text-secondary)] italic">
                        Aucun endpoint — backend hors ligne
                      </div>
                    }
                  </div>

                  <!-- Server icon -->
                  <div class="flex-shrink-0 w-10 flex flex-col items-center justify-center gap-1">
                    <div class="bg-[var(--bg-surface)] p-1.5 rounded-lg border border-[var(--border-main)] shadow-md">
                      <mat-icon class="text-emerald-500 w-5 h-5 text-[20px] leading-none">dns</mat-icon>
                    </div>
                    <span class="text-[9px] text-[var(--text-secondary)]">Serveur</span>
                  </div>
                </div>
              </div>

              <button (click)="toggleNoRedis()"
                      class="w-full py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md"
                      [ngClass]="isRunningNoRedis()
                        ? 'bg-[var(--accent)] text-white hover:bg-[#d94a3a]'
                        : 'bg-white text-slate-900 hover:bg-gray-200'">
                @if (isRunningNoRedis()) {
                  <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  Arrêter le tir
                } @else {
                  <mat-icon class="text-[var(--accent)]">play_circle</mat-icon>
                  Démarrer le tir automatique
                }
              </button>
            </div>

            <!-- Counter -->
            <div class="mt-auto pt-6 border-t border-[var(--border-main)]">
              <div class="flex items-center justify-between p-4 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/10">
                <div class="flex items-center gap-3 text-[var(--accent)]">
                  <mat-icon>warning</mat-icon>
                  <span class="font-medium text-sm">Requêtes perdues (downtime)</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-bold text-[var(--accent)]">{{ lostRequests() }}</span>
                  <button (click)="lostRequests.set(0)" title="Reset" class="text-[var(--text-secondary)] hover:text-white transition-colors">
                    <mat-icon class="text-[18px] w-[18px] h-[18px]">refresh</mat-icon>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- COLONNE DROITE : Avec Redis -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden relative">
          <div class="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] pointer-events-none"></div>

          <!-- Header -->
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20 relative z-10">
            <div class="flex items-center gap-3">
              <h3 class="font-heading font-semibold text-lg">Architecture Moderne</h3>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                Avec Redis
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium" [ngClass]="healthRedis() ? 'text-emerald-400' : 'text-rose-400'">
              <div class="w-2 h-2 rounded-full" [ngClass]="healthRedis() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></div>
              {{ healthRedis() ? 'En ligne' : 'Hors ligne' }}
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-6 relative z-10">

            <!-- Routes List -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium text-[var(--text-secondary)]">Routes Actives (Redis)</h4>
                <div class="flex items-center gap-1 text-[10px] text-[var(--primary)]">
                  <mat-icon class="text-[14px] w-[14px] h-[14px]">sync</mat-icon> Live
                </div>
              </div>
              <div class="flex flex-col gap-2">
                @for (route of routes(); track route.path) {
                  <div class="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="font-mono text-[var(--primary)]">{{ route.path }}</span>
                        <mat-icon class="text-[var(--text-secondary)] text-[16px] w-[16px] h-[16px]">arrow_forward</mat-icon>
                        <span class="font-mono text-white">{{ route.destination }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        @if (route.maintenance) {
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">503 Maintenance</span>
                        }
                        <span class="w-2 h-2 rounded-full" [ngClass]="route.active ? 'bg-emerald-400' : 'bg-rose-400'"></span>
                      </div>
                    </div>
                    <div class="flex justify-end mt-1">
                      <button (click)="toggleMaintenance(route)" class="text-xs flex items-center gap-1 px-2 py-1 rounded bg-black/20 hover:bg-black/40 transition-colors" [ngClass]="route.maintenance ? 'text-emerald-400' : 'text-orange-400'">
                        <mat-icon class="text-[14px] w-[14px] h-[14px]">{{ route.maintenance ? 'play_arrow' : 'pause_circle_filled' }}</mat-icon>
                        {{ route.maintenance ? 'Désactiver Maintenance' : 'Activer 503' }}
                      </button>
                    </div>
                  </div>
                }
                @if (routes().length === 0) {
                  <div class="text-center p-4 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                    Aucune route configurée
                  </div>
                }
              </div>
            </div>

            <!-- Inline Form -->
            <form [formGroup]="routeForm" (ngSubmit)="addRoute()" class="flex items-end gap-3 p-4 rounded-[var(--radius-inner)] bg-black/20 border border-[var(--border-main)]">
              <div class="flex-1">
                <label for="path" class="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Path</label>
                <input id="path" type="text" formControlName="path" class="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="/api/...">
              </div>
              <div class="flex-1">
                <label for="destination" class="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Destination</label>
                <input id="destination" type="text" formControlName="destination" class="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="service-name">
              </div>
              <button type="submit" [disabled]="routeForm.invalid" class="px-4 py-1.5 bg-white text-slate-900 text-sm font-bold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[34px] shadow-sm">
                Appliquer
              </button>
            </form>

            <!-- Action & Animation -->
            <div class="flex flex-col gap-4">
              <!-- Animation Client/Server -->
              <div class="bg-black/20 rounded-xl border border-[var(--border-main)] p-3">
                <div class="flex items-stretch gap-2">
                  <!-- Angular icon (Client) -->
                  <div class="flex-shrink-0 w-10 flex flex-col items-center justify-center gap-1">
                    <div class="bg-[var(--bg-surface)] p-1.5 rounded-lg border border-[var(--border-main)] shadow-md">
                      <svg viewBox="0 0 250 250" class="w-5 h-5"><path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/><path fill="#C3002F" d="M125 30v22.2-.1V230l78.9-43.7 14.2-123.1L125 30z"/><path fill="#FFA3B1" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9 17 40.9z"/></svg>
                    </div>
                    <span class="text-[9px] text-[var(--text-secondary)]">Client</span>
                  </div>

                  <!-- Endpoint lanes -->
                  <div class="flex-1 flex flex-col gap-1.5 min-w-0">
                    @for (route of routes(); track route.path) {
                      <div class="relative h-6 flex items-center overflow-hidden">
                        <div class="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border-main)]"></div>
                        <span class="relative z-10 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] px-1 rounded">{{ route.path }}</span>
                        @if (lastResRedis()[route.path]; as res) {
                          <span class="absolute right-0 z-10 text-[9px] font-mono bg-[var(--bg-surface)] px-1 rounded"
                                [ngClass]="res.error ? 'text-rose-400' : 'text-emerald-400'">
                            {{ res.error ? 'ERR' : res.durationMs + 'ms' }}
                          </span>
                        }
                        <!-- Ball -->
                        <div class="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ease-in-out"
                             [ngClass]="getBallClasses(animStatesRedis(), route.path)">
                          <div class="bg-[var(--primary)] text-white p-0.5 rounded-full shadow-[0_0_6px_var(--primary)] flex items-center justify-center">
                            <mat-icon class="text-[10px] w-[10px] h-[10px] leading-none">
                              {{ (animStatesRedis()[route.path] ?? 'idle') === 'returning' ? 'mark_email_read' : 'mail' }}
                            </mat-icon>
                          </div>
                        </div>
                      </div>
                    }
                    @if (routes().length === 0) {
                      <div class="flex items-center justify-center h-8 text-[10px] text-[var(--text-secondary)] italic">
                        Aucun endpoint — backend hors ligne
                      </div>
                    }
                  </div>

                  <!-- Server icon -->
                  <div class="flex-shrink-0 w-10 flex flex-col items-center justify-center gap-1">
                    <div class="bg-[var(--bg-surface)] p-1.5 rounded-lg border border-[var(--border-main)] shadow-md">
                      <mat-icon class="text-emerald-500 w-5 h-5 text-[20px] leading-none">dns</mat-icon>
                    </div>
                    <span class="text-[9px] text-[var(--text-secondary)]">Serveur</span>
                  </div>
                </div>
              </div>

              <button (click)="toggleRedis()"
                      class="w-full py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md"
                      [ngClass]="isRunningRedis()
                        ? 'bg-[var(--primary)] text-white hover:bg-[#5068b0]'
                        : 'bg-white text-slate-900 hover:bg-gray-200'">
                @if (isRunningRedis()) {
                  <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  Arrêter le tir
                } @else {
                  <mat-icon class="text-[var(--primary)]">play_circle</mat-icon>
                  Démarrer le tir automatique
                }
              </button>
            </div>

            <!-- Counter -->
            <div class="mt-auto pt-6 border-t border-[var(--border-main)]">
              <div class="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <div class="flex items-center gap-3 text-emerald-400">
                  <mat-icon>check_circle</mat-icon>
                  <span class="font-medium text-sm">Requêtes réussies (zéro downtime)</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-bold text-emerald-500">{{ successfulRequests() }}</span>
                  <button (click)="successfulRequests.set(0)" title="Reset" class="text-[var(--text-secondary)] hover:text-white transition-colors">
                    <mat-icon class="text-[18px] w-[18px] h-[18px]">refresh</mat-icon>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `
})
export class GatewayComponent {
  private gatewayService = inject(GatewayService);

  // State
  healthNoRedis = signal<boolean>(false);
  healthRedis = signal<boolean>(false);

  lostRequests = signal<number>(0);
  successfulRequests = signal<number>(0);

  noRedisEndpoints = signal<RouteDef[]>([]);
  routes = signal<RouteDef[]>([]);

  animStatesNoRedis = signal<Partial<Record<string, AnimState>>>({});
  animStatesRedis = signal<Partial<Record<string, AnimState>>>({});

  lastResNoRedis = signal<Partial<Record<string, HelloResponse>>>({});
  lastResRedis = signal<Partial<Record<string, HelloResponse>>>({});

  isRunningNoRedis = signal(false);
  isRunningRedis = signal(false);

  private readonly FIRE_INTERVAL_MS = 1200;

  // Form
  routeForm = new FormGroup({
    path: new FormControl('/api/new', { nonNullable: true }),
    destination: new FormControl('service-b', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true })
  });

  constructor() {
    // Health polling
    interval(500).pipe(
      switchMap(() => this.gatewayService.checkHealth(false)),
      takeUntilDestroyed()
    ).subscribe(status => this.healthNoRedis.set(status));

    interval(500).pipe(
      switchMap(() => this.gatewayService.checkHealth(true)),
      takeUntilDestroyed()
    ).subscribe(status => this.healthRedis.set(status));

    // No-redis routes polling (5s + immediate)
    this.gatewayService.getNoRedisRoutes().subscribe(r => this.noRedisEndpoints.set(r));
    interval(5000).pipe(
      switchMap(() => this.gatewayService.getNoRedisRoutes()),
      takeUntilDestroyed()
    ).subscribe(r => this.noRedisEndpoints.set(r));

    // Redis routes polling (2s)
    interval(2000).pipe(
      switchMap(() => this.gatewayService.getRoutes()),
      takeUntilDestroyed()
    ).subscribe(r => this.routes.set(r));

    // Auto-fire No Redis — all endpoints in parallel
    interval(this.FIRE_INTERVAL_MS).pipe(
      filter(() => this.isRunningNoRedis()),
      switchMap(() => {
        const paths = this.noRedisEndpoints().map(r => r.path);
        if (paths.length === 0) return EMPTY;
        return forkJoin(paths.map(path =>
          this.gatewayService.callEndpoint(false, path).pipe(map(res => ({ path, res })))
        ));
      }),
      takeUntilDestroyed()
    ).subscribe(results => {
      results.forEach(({ path, res }) => {
        if (res.error) this.lostRequests.update(v => v + 1);
        this.lastResNoRedis.update(r => ({ ...r, [path]: res }));
        this.triggerAnim(this.animStatesNoRedis, path);
      });
    });

    // Auto-fire Redis — all routes in parallel
    interval(this.FIRE_INTERVAL_MS).pipe(
      filter(() => this.isRunningRedis()),
      switchMap(() => {
        const paths = this.routes().map(r => r.path);
        if (paths.length === 0) return EMPTY;
        return forkJoin(paths.map(path =>
          this.gatewayService.callEndpoint(true, path).pipe(map(res => ({ path, res })))
        ));
      }),
      takeUntilDestroyed()
    ).subscribe(results => {
      results.forEach(({ path, res }) => {
        if (!res.error) this.successfulRequests.update(v => v + 1);
        this.lastResRedis.update(r => ({ ...r, [path]: res }));
        this.triggerAnim(this.animStatesRedis, path);
      });
    });
  }

  /** Triggers the 4-step Angular→Server→Angular animation for a single endpoint lane. */
  private triggerAnim(statesSignal: WritableSignal<Partial<Record<string, AnimState>>>, path: string): void {
    statesSignal.update(s => ({ ...s, [path]: 'departing' }));
    setTimeout(() => statesSignal.update(s => ({ ...s, [path]: 'sending' })), 150);
    setTimeout(() => statesSignal.update(s => ({ ...s, [path]: 'returning' })), 450);
    setTimeout(() => statesSignal.update(s => ({ ...s, [path]: 'idle' })), 750);
  }

  /** Returns ngClass object for the animated ball in a given endpoint lane. */
  getBallClasses(states: Partial<Record<string, AnimState>>, path: string): Record<string, boolean> {
    const state = states[path] ?? 'idle';
    const sending = state === 'sending';
    const idle = state === 'idle';
    return {
      'left-0': !sending,
      'left-[calc(100%-14px)]': sending,
      'opacity-0': idle,
      'opacity-100': !idle,
      'scale-50': idle,
      'scale-100': !idle,
    };
  }

  toggleNoRedis() { this.isRunningNoRedis.update(v => !v); }
  toggleRedis()   { this.isRunningRedis.update(v => !v); }

  addRoute() {
    if (this.routeForm.valid) {
      const newRoute = this.routeForm.getRawValue();
      this.gatewayService.addRoute(newRoute).subscribe(success => {
        if (success) {
          this.gatewayService.getRoutes().subscribe(r => this.routes.set(r));
          this.routeForm.reset({ path: '/api/new', destination: 'service-b', active: true });
        }
      });
    }
  }

  toggleMaintenance(route: RouteDef) {
    const updatedRoute = { ...route, maintenance: !route.maintenance };
    this.gatewayService.updateRoute(updatedRoute).subscribe(success => {
      if (success) {
        this.gatewayService.getRoutes().subscribe(r => this.routes.set(r));
      }
    });
  }
}
