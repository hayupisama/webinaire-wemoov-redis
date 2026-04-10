import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, DatePipe } from '@angular/common';
import { TtlService, NoTtlSession, WithTtlSession, NoTtlToken, WithTtlToken } from './ttl.service';
import { interval, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-ttl',
  standalone: true,
  imports: [MatIconModule, NgClass, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-5">
        <h2 class="text-3xl font-heading font-bold text-white">TTL & Eviction</h2>
        <p class="text-[var(--text-secondary)] mt-2">Comprenez la gestion de la mémoire avec l'expiration automatique (TTL) et les stratégies d'éviction.</p>
      </div>

      <!-- Onglets -->
      <div class="flex gap-2 mb-5">
        <button
          (click)="activeTab.set('session')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
          [ngClass]="activeTab() === 'session'
            ? 'bg-[var(--primary)]/15 text-white border-[var(--primary)]/40'
            : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--primary)]/30 hover:text-white'"
        >
          <mat-icon class="scale-75">manage_accounts</mat-icon>
          Sessions Utilisateur
        </button>
        <button
          (click)="activeTab.set('2fa')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
          [ngClass]="activeTab() === '2fa'
            ? 'bg-[var(--primary)]/15 text-white border-[var(--primary)]/40'
            : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--primary)]/30 hover:text-white'"
        >
          <mat-icon class="scale-75">security</mat-icon>
          Jeton 2FA
        </button>

        <div class="ml-auto flex items-center gap-2">
          <span class="flex items-center gap-1.5 text-sm font-medium" [ngClass]="healthBackend() ? 'text-emerald-400' : 'text-rose-400'">
            <span class="w-2 h-2 rounded-full" [ngClass]="healthBackend() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
            {{ healthBackend() ? 'Backend en ligne' : 'Backend hors ligne' }}
          </span>
        </div>
      </div>

      <!-- ═══════════════ ONGLET SESSIONS ═══════════════ -->
      @if (activeTab() === 'session') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

          <!-- GAUCHE : Sans TTL natif -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--text-secondary)]">storage</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Sans TTL natif (PostgreSQL)</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="flex flex-col gap-4 bg-black/20 p-5 rounded-xl border border-[var(--border-main)]">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-[var(--text-secondary)]">Nom d'utilisateur</label>
                  <input type="text"
                         [ngModel]="noTtlUsername()" (ngModelChange)="noTtlUsername.set($event)"
                         placeholder="Ex: alice_89"
                         class="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors">
                </div>
                <button (click)="createNoTtlSession()" [disabled]="!noTtlUsername().trim() || isCreatingNoTtl()"
                        class="py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  @if (isCreatingNoTtl()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Création...
                  } @else {
                    <mat-icon class="text-[var(--accent)]">person_add</mat-icon> Créer une session (sans expiration)
                  }
                </button>
              </div>

              <div class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2 text-sm text-yellow-200/80">
                <mat-icon class="text-[18px] w-[18px] h-[18px] text-yellow-400 mt-0.5">info</mat-icon>
                <span>Ces sessions ne s'effacent jamais seules — un batch est nécessaire.</span>
              </div>

              <div class="flex-1 flex flex-col gap-3">
                <h4 class="font-medium text-white flex items-center gap-2 border-b border-[var(--border-main)] pb-2">
                  <mat-icon class="text-[18px] w-[18px] h-[18px]">list</mat-icon>
                  Sessions actives ({{ noTtlSessions().length }})
                </h4>
                <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                  @for (session of noTtlSessions(); track session.id) {
                    <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 animate-fade-in">
                      <div class="flex flex-col">
                        <span class="font-bold text-white">{{ session.username }}</span>
                        <span class="text-xs text-[var(--text-secondary)]">Créée le : {{ session.createdAt | date:'HH:mm:ss' }}</span>
                      </div>
                      <span class="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
                      </span>
                    </div>
                  }
                  @if (noTtlSessions().length === 0) {
                    <div class="text-center p-6 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                      Aucune session active.
                    </div>
                  }
                </div>
              </div>

              <div class="mt-auto flex flex-col gap-2">
                <button (click)="cleanupNoTtlSessions()" [disabled]="isCleaningUp()"
                        class="py-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold">
                  @if (isCleaningUp()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Nettoyage...
                  } @else {
                    <mat-icon>delete_sweep</mat-icon> Simuler le batch de nettoyage (> 30s)
                  }
                </button>
                <button (click)="resetAll()" [disabled]="isResetting()"
                        class="py-3 bg-black/40 hover:bg-black/60 border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold">
                  <mat-icon>refresh</mat-icon> Réinitialiser la démo
                </button>
              </div>
            </div>
          </div>

          <!-- DROITE : Avec Redis TTL -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--primary)]">timer</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Avec Redis TTL</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="flex flex-col gap-4 bg-black/20 p-5 rounded-xl border border-[var(--border-main)]">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-[var(--text-secondary)]">Nom d'utilisateur</label>
                  <input type="text"
                         [ngModel]="withTtlUsername()" (ngModelChange)="withTtlUsername.set($event)"
                         placeholder="Ex: bob_42"
                         class="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors">
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex justify-between items-center">
                    <label class="text-sm font-medium text-[var(--text-secondary)]">Durée de vie (TTL)</label>
                    <span class="text-[var(--primary)] font-bold bg-[var(--primary)]/10 px-2 py-0.5 rounded text-sm">{{ ttlValue() }} s</span>
                  </div>
                  <input type="range"
                         [ngModel]="ttlValue()" (ngModelChange)="ttlValue.set(+$event)"
                         min="5" max="60" step="1"
                         class="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]">
                </div>
                <button (click)="createWithTtlSession()" [disabled]="!withTtlUsername().trim() || isCreatingWithTtl()"
                        class="mt-2 py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  @if (isCreatingWithTtl()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Création...
                  } @else {
                    <mat-icon class="text-[var(--primary)]">timer</mat-icon> Créer une session
                  }
                </button>
              </div>

              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-sm text-emerald-200/80">
                <mat-icon class="text-[18px] w-[18px] h-[18px] text-emerald-400 mt-0.5">auto_awesome</mat-icon>
                <span>Aucun batch. Aucune intervention. Redis gère seul.</span>
              </div>

              <div class="flex-1 flex flex-col gap-3">
                <h4 class="font-medium text-white flex items-center gap-2 border-b border-[var(--border-main)] pb-2">
                  <mat-icon class="text-[18px] w-[18px] h-[18px]">list</mat-icon>
                  Sessions actives ({{ withTtlSessions().length }})
                </h4>
                <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                  @for (session of withTtlSessions(); track session.id) {
                    <div class="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10 animate-fade-in transition-opacity duration-500"
                         [ngClass]="{'opacity-0': session.ttlRemaining <= 0}">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-white">{{ session.username }}</span>
                        <span class="text-xs font-mono font-bold" [ngClass]="getTtlTextColor(session.ttlRemaining)">
                          {{ session.ttlRemaining }}s
                        </span>
                      </div>
                      <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div class="h-full transition-all duration-500 ease-linear"
                             [ngClass]="getTtlBgColor(session.ttlRemaining)"
                             [style.width.%]="(session.ttlRemaining / session.initialTtl) * 100">
                        </div>
                      </div>
                    </div>
                  }
                  @if (withTtlSessions().length === 0) {
                    <div class="text-center p-6 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                      Aucune session active.
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

        </div>
      }

      <!-- ═══════════════ ONGLET 2FA ═══════════════ -->
      @if (activeTab() === '2fa') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

          <!-- GAUCHE : Sans TTL natif -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--text-secondary)]">storage</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Sans TTL natif (PostgreSQL)</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="flex flex-col gap-4 bg-black/20 p-5 rounded-xl border border-[var(--border-main)]">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-[var(--text-secondary)]">Email</label>
                  <input type="email"
                         [ngModel]="noTtlEmail()" (ngModelChange)="noTtlEmail.set($event)"
                         placeholder="Ex: alice@example.com"
                         class="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors">
                </div>
                <button (click)="generateNoTtlToken()" [disabled]="!noTtlEmail().trim() || isGeneratingNoTtl()"
                        class="py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  @if (isGeneratingNoTtl()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Génération...
                  } @else {
                    <mat-icon class="text-[var(--accent)]">lock</mat-icon> Générer un jeton 2FA
                  }
                </button>
              </div>

              <div class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2 text-sm text-yellow-200/80">
                <mat-icon class="text-[18px] w-[18px] h-[18px] text-yellow-400 mt-0.5">warning</mat-icon>
                <div class="flex flex-col gap-1">
                  <span class="font-semibold text-yellow-300">Expiration manuelle requise</span>
                  <span>Le backend doit calculer <code class="bg-black/30 px-1 rounded text-xs">now - createdAt &gt; 5min</code> à chaque vérification, et un batch est nécessaire pour supprimer les jetons expirés.</span>
                </div>
              </div>

              <div class="flex-1 flex flex-col gap-3">
                <h4 class="font-medium text-white flex items-center gap-2 border-b border-[var(--border-main)] pb-2">
                  <mat-icon class="text-[18px] w-[18px] h-[18px]">key</mat-icon>
                  Jetons actifs ({{ noTtlTokens().length }})
                </h4>
                <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                  @for (token of noTtlTokens(); track token.id) {
                    <div class="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/10 animate-fade-in">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-bold text-white text-sm">{{ token.email }}</span>
                        <span class="font-mono text-lg tracking-[0.25em] text-[var(--primary)]">{{ token.code }}</span>
                        <span class="text-xs text-[var(--text-secondary)]">Créé le : {{ token.createdAt | date:'HH:mm:ss' }}</span>
                        <span class="text-xs" [ngClass]="getTokenAgeColor(token.createdAt)">
                          {{ getTokenAge(token.createdAt) }}
                        </span>
                      </div>
                      <span class="text-xs font-bold px-2 py-1 rounded border flex items-center gap-1 mt-1 shrink-0"
                            [ngClass]="isTokenExpired(token.createdAt)
                              ? 'text-rose-400 bg-rose-400/10 border-rose-400/20'
                              : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'">
                        <span class="w-1.5 h-1.5 rounded-full"
                              [ngClass]="isTokenExpired(token.createdAt) ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'"></span>
                        {{ isTokenExpired(token.createdAt) ? 'Expiré' : 'Valide' }}
                      </span>
                    </div>
                  }
                  @if (noTtlTokens().length === 0) {
                    <div class="text-center p-6 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                      Aucun jeton actif.
                    </div>
                  }
                </div>
              </div>

              <div class="mt-auto flex flex-col gap-2">
                <button (click)="cleanupExpiredTokens()" [disabled]="isCleaningUpTokens()"
                        class="py-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold">
                  @if (isCleaningUpTokens()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Nettoyage...
                  } @else {
                    <mat-icon>delete_sweep</mat-icon> Simuler le batch de nettoyage (> 5min)
                  }
                </button>
                <button (click)="resetTokens()" [disabled]="isResettingTokens()"
                        class="py-3 bg-black/40 hover:bg-black/60 border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold">
                  <mat-icon>refresh</mat-icon> Réinitialiser la démo
                </button>
              </div>
            </div>
          </div>

          <!-- DROITE : Avec Redis TTL -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--primary)]">timer</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Avec Redis TTL</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="flex flex-col gap-4 bg-black/20 p-5 rounded-xl border border-[var(--border-main)]">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-[var(--text-secondary)]">Email</label>
                  <input type="email"
                         [ngModel]="withTtlEmail()" (ngModelChange)="withTtlEmail.set($event)"
                         placeholder="Ex: bob@example.com"
                         class="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors">
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex justify-between items-center">
                    <label class="text-sm font-medium text-[var(--text-secondary)]">Durée de validité (TTL)</label>
                    <span class="text-[var(--primary)] font-bold bg-[var(--primary)]/10 px-2 py-0.5 rounded text-sm">{{ tokenTtlValue() }} s</span>
                  </div>
                  <input type="range"
                         [ngModel]="tokenTtlValue()" (ngModelChange)="tokenTtlValue.set(+$event)"
                         min="10" max="300" step="10"
                         class="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]">
                  <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>10s (démo)</span>
                    <span>5min (réel)</span>
                  </div>
                </div>
                <button (click)="generateWithTtlToken()" [disabled]="!withTtlEmail().trim() || isGeneratingWithTtl()"
                        class="mt-2 py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  @if (isGeneratingWithTtl()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon> Génération...
                  } @else {
                    <mat-icon class="text-[var(--primary)]">lock</mat-icon> Générer un jeton 2FA
                  }
                </button>
              </div>

              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-sm text-emerald-200/80">
                <mat-icon class="text-[18px] w-[18px] h-[18px] text-emerald-400 mt-0.5">auto_awesome</mat-icon>
                <div class="flex flex-col gap-1">
                  <span class="font-semibold text-emerald-300">Expiration automatique</span>
                  <span>Redis supprime le jeton à l'expiration du TTL. Aucun calcul, aucun batch, aucune intervention.</span>
                </div>
              </div>

              <div class="flex-1 flex flex-col gap-3">
                <h4 class="font-medium text-white flex items-center gap-2 border-b border-[var(--border-main)] pb-2">
                  <mat-icon class="text-[18px] w-[18px] h-[18px]">key</mat-icon>
                  Jetons actifs ({{ withTtlTokens().length }})
                </h4>
                <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                  @for (token of withTtlTokens(); track token.id) {
                    <div class="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10 animate-fade-in transition-opacity duration-500"
                         [ngClass]="{'opacity-0': token.ttlRemaining <= 0}">
                      <div class="flex items-center justify-between">
                        <div class="flex flex-col gap-0.5">
                          <span class="font-bold text-white text-sm">{{ token.email }}</span>
                          <span class="font-mono text-lg tracking-[0.25em] text-[var(--primary)]">{{ token.code }}</span>
                        </div>
                        <span class="text-xs font-mono font-bold" [ngClass]="getTtlTextColor(token.ttlRemaining)">
                          {{ token.ttlRemaining }}s
                        </span>
                      </div>
                      <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div class="h-full transition-all duration-500 ease-linear"
                             [ngClass]="getTtlBgColor(token.ttlRemaining)"
                             [style.width.%]="(token.ttlRemaining / token.initialTtl) * 100">
                        </div>
                      </div>
                    </div>
                  }
                  @if (withTtlTokens().length === 0) {
                    <div class="text-center p-6 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                      Aucun jeton actif.
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

        </div>
      }

    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class TtlComponent {
  private ttlService = inject(TtlService);

  activeTab = signal<'session' | '2fa'>('session');

  healthBackend = signal(false);

  // Session state
  noTtlUsername = signal('');
  noTtlSessions = signal<NoTtlSession[]>([]);
  isCreatingNoTtl = signal(false);
  isCleaningUp = signal(false);
  isResetting = signal(false);

  withTtlUsername = signal('');
  ttlValue = signal(30);
  withTtlSessions = signal<WithTtlSession[]>([]);
  isCreatingWithTtl = signal(false);

  // 2FA state
  noTtlEmail = signal('');
  noTtlTokens = signal<NoTtlToken[]>([]);
  isGeneratingNoTtl = signal(false);
  isCleaningUpTokens = signal(false);
  isResettingTokens = signal(false);

  withTtlEmail = signal('');
  tokenTtlValue = signal(60);
  withTtlTokens = signal<WithTtlToken[]>([]);
  isGeneratingWithTtl = signal(false);

  // Track current time for age calculation
  now = signal(Date.now());

  constructor() {
    interval(500).pipe(
      switchMap(() => this.ttlService.checkHealth()),
      takeUntilDestroyed()
    ).subscribe(h => this.healthBackend.set(h));

    // Update current time every second for age display
    interval(1000).pipe(takeUntilDestroyed()).subscribe(() => this.now.set(Date.now()));

    // Poll sessions
    interval(2000).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.ttlService.getNoTtlSessions())
    ).subscribe(sessions => this.noTtlSessions.set(sessions));

    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.ttlService.getWithTtlSessions())
    ).subscribe(sessions => this.withTtlSessions.set(sessions));

    // Poll 2FA tokens
    interval(2000).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.ttlService.getNoTtlTokens())
    ).subscribe(tokens => this.noTtlTokens.set(tokens));

    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.ttlService.getWithTtlTokens())
    ).subscribe(tokens => this.withTtlTokens.set(tokens));
  }

  // --- Session actions ---
  createNoTtlSession() {
    if (!this.noTtlUsername().trim()) return;
    this.isCreatingNoTtl.set(true);
    this.ttlService.createNoTtlSession(this.noTtlUsername()).subscribe(() => {
      this.noTtlUsername.set('');
      this.isCreatingNoTtl.set(false);
      this.ttlService.getNoTtlSessions().subscribe(s => this.noTtlSessions.set(s));
    });
  }

  cleanupNoTtlSessions() {
    this.isCleaningUp.set(true);
    this.ttlService.cleanupNoTtlSessions().subscribe(() => {
      this.isCleaningUp.set(false);
      this.ttlService.getNoTtlSessions().subscribe(s => this.noTtlSessions.set(s));
    });
  }

  resetAll() {
    this.isResetting.set(true);
    this.ttlService.resetAll().subscribe(() => {
      this.isResetting.set(false);
      this.noTtlSessions.set([]);
      this.withTtlSessions.set([]);
      this.noTtlUsername.set('');
      this.withTtlUsername.set('');
    });
  }

  createWithTtlSession() {
    if (!this.withTtlUsername().trim()) return;
    this.isCreatingWithTtl.set(true);
    this.ttlService.createWithTtlSession(this.withTtlUsername(), this.ttlValue()).subscribe(() => {
      this.withTtlUsername.set('');
      this.isCreatingWithTtl.set(false);
      this.ttlService.getWithTtlSessions().subscribe(s => this.withTtlSessions.set(s));
    });
  }

  // --- 2FA actions ---
  generateNoTtlToken() {
    if (!this.noTtlEmail().trim()) return;
    this.isGeneratingNoTtl.set(true);
    this.ttlService.generateNoTtlToken(this.noTtlEmail()).subscribe(() => {
      this.noTtlEmail.set('');
      this.isGeneratingNoTtl.set(false);
      this.ttlService.getNoTtlTokens().subscribe(t => this.noTtlTokens.set(t));
    });
  }

  cleanupExpiredTokens() {
    this.isCleaningUpTokens.set(true);
    this.ttlService.cleanupExpiredTokens().subscribe(() => {
      this.isCleaningUpTokens.set(false);
      this.ttlService.getNoTtlTokens().subscribe(t => this.noTtlTokens.set(t));
    });
  }

  resetTokens() {
    this.isResettingTokens.set(true);
    this.ttlService.resetTokens().subscribe(() => {
      this.isResettingTokens.set(false);
      this.noTtlTokens.set([]);
      this.withTtlTokens.set([]);
      this.noTtlEmail.set('');
      this.withTtlEmail.set('');
    });
  }

  generateWithTtlToken() {
    if (!this.withTtlEmail().trim()) return;
    this.isGeneratingWithTtl.set(true);
    this.ttlService.generateWithTtlToken(this.withTtlEmail(), this.tokenTtlValue()).subscribe(() => {
      this.withTtlEmail.set('');
      this.isGeneratingWithTtl.set(false);
      this.ttlService.getWithTtlTokens().subscribe(t => this.withTtlTokens.set(t));
    });
  }

  // --- Helpers ---
  getTtlBgColor(ttl: number): string {
    if (ttl <= 5) return 'bg-rose-500';
    if (ttl <= 10) return 'bg-orange-500';
    return 'bg-[var(--primary)]';
  }

  getTtlTextColor(ttl: number): string {
    if (ttl <= 5) return 'text-rose-400';
    if (ttl <= 10) return 'text-orange-400';
    return 'text-[var(--primary)]';
  }

  // 5min expiry for no-TTL tokens
  isTokenExpired(createdAt: number): boolean {
    return (this.now() - createdAt) > 5 * 60 * 1000;
  }

  getTokenAge(createdAt: number): string {
    const seconds = Math.floor((this.now() - createdAt) / 1000);
    if (seconds < 60) return `Âge : ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `Âge : ${minutes}min ${secs}s`;
  }

  getTokenAgeColor(createdAt: number): string {
    const seconds = Math.floor((this.now() - createdAt) / 1000);
    if (seconds > 300) return 'text-rose-400';
    if (seconds > 240) return 'text-orange-400';
    return 'text-[var(--text-secondary)]';
  }
}
