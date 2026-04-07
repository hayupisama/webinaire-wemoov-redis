import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';
import { LocksService, ThreadStatus, ThreadState, BookingStatus, Seat } from './locks.service';
import { interval, switchMap, forkJoin, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const DEFAULT_BOOKING: BookingStatus = {
  clientA: { state: 'IDLE', message: '', success: false },
  clientB: { state: 'IDLE', message: '', success: false },
  done: false,
};

@Component({
  selector: 'app-locks',
  standalone: true,
  imports: [MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">

      <!-- Header -->
      <div class="mb-5">
        <h2 class="text-3xl font-heading font-bold text-white">Distributed Locks</h2>
        <p class="text-[var(--text-secondary)] mt-2">Gérez la concurrence entre vos microservices en toute sécurité grâce aux verrous distribués (Redlock).</p>
      </div>

      <!-- Onglets -->
      <div class="flex gap-2 mb-5">
        <button
          (click)="activeTab.set('bank')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
          [ngClass]="activeTab() === 'bank'
            ? 'bg-[var(--primary)]/15 text-white border-[var(--primary)]/40'
            : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--primary)]/30 hover:text-white'"
        >
          <mat-icon class="scale-75">account_balance</mat-icon>
          Compte Bancaire
        </button>
        <button
          (click)="activeTab.set('concert')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
          [ngClass]="activeTab() === 'concert'
            ? 'bg-[var(--primary)]/15 text-white border-[var(--primary)]/40'
            : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--primary)]/30 hover:text-white'"
        >
          <mat-icon class="scale-75">confirmation_number</mat-icon>
          Réservation Concert
        </button>

        <div class="ml-auto flex items-center gap-2">
          <span class="flex items-center gap-1.5 text-sm font-medium" [ngClass]="healthBackend() ? 'text-emerald-400' : 'text-rose-400'">
            <span class="w-2 h-2 rounded-full" [ngClass]="healthBackend() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
            {{ healthBackend() ? 'Backend en ligne' : 'Backend hors ligne' }}
          </span>
        </div>
      </div>

      <!-- ═══════════════ ONGLET COMPTE BANCAIRE ═══════════════ -->
      @if (activeTab() === 'bank') {

        <!-- Compte central -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] p-6 mb-6 flex justify-between items-center relative overflow-hidden">
          <div class="absolute right-0 top-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] pointer-events-none"></div>
          <div class="relative z-10">
            <h3 class="text-lg font-heading font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              <mat-icon class="text-[var(--primary)]">account_balance</mat-icon>
              Compte #FR001
            </h3>
            <div class="text-5xl font-bold font-mono mt-2 transition-colors duration-300"
                 [ngClass]="isBalanceInconsistent() ? 'text-rose-500' : 'text-white'">
              {{ balance() }} €
            </div>
            @if (isBalanceInconsistent()) {
              <div class="text-rose-400 text-sm mt-2 flex items-center gap-1 font-medium bg-rose-500/10 px-3 py-1.5 rounded-md w-fit border border-rose-500/20">
                <mat-icon class="text-[16px] w-[16px] h-[16px]">warning</mat-icon>
                Incohérence détectée (Attendu: {{ expected() }} €)
              </div>
            } @else {
              <div class="text-emerald-400 text-sm mt-2 flex items-center gap-1 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-md w-fit border border-emerald-500/20">
                <mat-icon class="text-[16px] w-[16px] h-[16px]">check_circle</mat-icon>
                Solde cohérent
              </div>
            }
          </div>
          <button (click)="resetAccount()" class="px-6 py-3 bg-white text-slate-900 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-2 font-bold shadow-md relative z-10">
            <mat-icon>refresh</mat-icon>
            Réinitialiser à 1000€
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

          <!-- Sans verrou -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--accent)]">lock_open</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Sans verrou</h3>
            </div>
            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300" [ngClass]="getCardBorder(noLockStatus().threadA)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Thread A</span>
                  <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" [ngClass]="getStatusColor(noLockStatus().threadA)">
                    @if (isWorking(noLockStatus().threadA)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                    {{ translateStatus(noLockStatus().threadA) }}
                  </div>
                </div>
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300" [ngClass]="getCardBorder(noLockStatus().threadB)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Thread B</span>
                  <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" [ngClass]="getStatusColor(noLockStatus().threadB)">
                    @if (isWorking(noLockStatus().threadB)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                    {{ translateStatus(noLockStatus().threadB) }}
                  </div>
                </div>
              </div>
              <button (click)="runNoLock()" [disabled]="!canRunNoLock()"
                      class="py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md w-full">
                <mat-icon class="text-[var(--accent)]">play_arrow</mat-icon>
                Lancer les 2 threads simultanément
              </button>
              @if (noLockStatus().done) {
                <div class="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 flex flex-col gap-2 animate-fade-in">
                  <div class="flex items-center gap-2 text-rose-400 font-bold"><mat-icon>warning</mat-icon> Incohérence détectée</div>
                  <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Les deux threads ont lu le solde à 1000€ en même temps et ont chacun déduit 500€.
                    Solde final : <strong class="text-white">{{ noLockStatus().finalActual }} €</strong>
                    au lieu de <strong class="text-white">{{ noLockStatus().finalExpected }} €</strong>.
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Avec verrou Redis -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
              <div class="flex items-center gap-3">
                <mat-icon class="text-[var(--primary)]">lock</mat-icon>
                <h3 class="font-heading font-semibold text-lg">Avec verrou Redis</h3>
              </div>
              <div class="px-3 py-1 rounded-full text-xs font-bold border transition-colors duration-300"
                   [ngClass]="lockOwner() ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'">
                @if (lockOwner()) {
                  <span class="flex items-center gap-1"><mat-icon class="text-[14px] w-[14px] h-[14px]">lock</mat-icon> Verrou acquis par Thread {{ lockOwner() }}</span>
                } @else {
                  <span class="flex items-center gap-1"><mat-icon class="text-[14px] w-[14px] h-[14px]">lock_open</mat-icon> Verrou libre</span>
                }
              </div>
            </div>
            <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300" [ngClass]="getCardBorder(withLockStatus().threadA)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Thread A</span>
                  <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" [ngClass]="getStatusColor(withLockStatus().threadA)">
                    @if (isWorking(withLockStatus().threadA)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                    {{ translateStatus(withLockStatus().threadA) }}
                  </div>
                </div>
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300" [ngClass]="getCardBorder(withLockStatus().threadB)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Thread B</span>
                  <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" [ngClass]="getStatusColor(withLockStatus().threadB)">
                    @if (isWorking(withLockStatus().threadB)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                    {{ translateStatus(withLockStatus().threadB) }}
                  </div>
                </div>
              </div>
              <button (click)="runWithLock()" [disabled]="!canRunWithLock()"
                      class="py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md w-full">
                <mat-icon class="text-[var(--primary)]">play_arrow</mat-icon>
                Lancer les 2 threads simultanément
              </button>
              @if (withLockStatus().done) {
                <div class="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 flex flex-col gap-2 animate-fade-in">
                  <div class="flex items-center gap-2 text-emerald-400 font-bold"><mat-icon>check_circle</mat-icon> Cohérence garantie</div>
                  <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Le verrou a forcé l'exécution séquentielle. Solde final : <strong class="text-white">{{ withLockStatus().finalActual }} €</strong>.
                  </div>
                </div>
              }
            </div>
          </div>

        </div>
      }

      <!-- ═══════════════ ONGLET CONCERT ═══════════════ -->
      @if (activeTab() === 'concert') {

        <!-- Grille des sièges -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] p-5 mb-5 relative overflow-hidden">
          <div class="absolute right-0 top-0 w-48 h-48 bg-[var(--primary)]/5 rounded-full blur-[60px] pointer-events-none"></div>

          <!-- Scène -->
          <div class="text-center text-xs text-[var(--text-secondary)] font-mono tracking-widest mb-4 py-2 border border-[var(--border-main)] rounded-lg bg-black/20">
            ════════════════  🎭  SCÈNE  ════════════════
          </div>

          <!-- Rangées -->
          <div class="flex flex-col gap-2 items-center">
            @for (row of ['A', 'B']; track row) {
              <div class="flex items-center gap-2">
                <span class="text-xs text-[var(--text-secondary)] font-mono w-4 text-right shrink-0">{{ row }}</span>
                <div class="flex gap-1.5">
                  @for (seat of seatsInRow(row); track seat.id) {
                    <button
                      (click)="selectSeat(seat.id)"
                      class="w-11 h-9 rounded-lg text-[11px] font-bold transition-all duration-200 relative"
                      [ngClass]="seatClass(seat)"
                      [title]="seat.id + ' — ' + seatLabel(seat.status)"
                    >
                      {{ seat.id }}
                      @if (seat.id === selectedSeat()) {
                        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border border-[var(--bg-surface)]"></span>
                      }
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Légende + cible -->
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-main)]">
            <div class="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-slate-600 inline-block"></span> Disponible</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-orange-500/60 inline-block"></span> Réservé</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500/60 inline-block"></span> Payé</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-[var(--text-secondary)]">
                Siège cible : <strong class="text-white font-mono">{{ selectedSeat() }}</strong>
              </span>
              <button (click)="resetConcert()" class="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-all">
                <mat-icon class="text-[14px] w-[14px] h-[14px]">refresh</mat-icon>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        <!-- 2 colonnes : sans verrou / avec verrou -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

          <!-- Sans verrou -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center gap-3 bg-black/20">
              <mat-icon class="text-[var(--accent)]">lock_open</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Sans verrou</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-5 overflow-y-auto">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-2 transition-colors duration-300" [ngClass]="getBookingCardBorder(noLockBooking().clientA.state)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Client A</span>
                  <div class="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit transition-colors duration-300" [ngClass]="getBookingStateColor(noLockBooking().clientA.state)">
                    @if (isBookingWorking(noLockBooking().clientA.state)) { <mat-icon class="animate-spin text-[12px] w-[12px] h-[12px]">autorenew</mat-icon> }
                    {{ translateBookingState(noLockBooking().clientA.state) }}
                  </div>
                  @if (noLockBooking().clientA.message) {
                    <p class="text-[11px] text-[var(--text-secondary)] leading-tight">{{ noLockBooking().clientA.message }}</p>
                  }
                </div>
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-2 transition-colors duration-300" [ngClass]="getBookingCardBorder(noLockBooking().clientB.state)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Client B</span>
                  <div class="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit transition-colors duration-300" [ngClass]="getBookingStateColor(noLockBooking().clientB.state)">
                    @if (isBookingWorking(noLockBooking().clientB.state)) { <mat-icon class="animate-spin text-[12px] w-[12px] h-[12px]">autorenew</mat-icon> }
                    {{ translateBookingState(noLockBooking().clientB.state) }}
                  </div>
                  @if (noLockBooking().clientB.message) {
                    <p class="text-[11px] text-[var(--text-secondary)] leading-tight">{{ noLockBooking().clientB.message }}</p>
                  }
                </div>
              </div>

              <button (click)="runNoLockBooking()" [disabled]="!canRunNoLockBooking()"
                      class="py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md w-full">
                <mat-icon class="text-[var(--accent)]">play_arrow</mat-icon>
                Lancer la course simultanée
              </button>

              @if (noLockBooking().done && noLockBooking().clientA.success && noLockBooking().clientB.success) {
                <div class="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 flex flex-col gap-2 animate-fade-in">
                  <div class="flex items-center gap-2 text-rose-400 font-bold"><mat-icon>warning</mat-icon> Double réservation !</div>
                  <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Client A et Client B ont tous les deux lu la place <strong class="text-white">{{ selectedSeat() }}</strong> comme disponible et l'ont réservée simultanément.
                    <strong class="text-rose-300"> Deux billets ont été émis pour le même siège.</strong>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Avec verrou Redis -->
          <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
            <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
              <div class="flex items-center gap-3">
                <mat-icon class="text-[var(--primary)]">lock</mat-icon>
                <h3 class="font-heading font-semibold text-lg">Avec verrou Redis</h3>
              </div>
              <div class="px-3 py-1 rounded-full text-xs font-bold border transition-colors duration-300"
                   [ngClass]="concertLockOwner() ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'">
                @if (concertLockOwner()) {
                  <span class="flex items-center gap-1"><mat-icon class="text-[14px] w-[14px] h-[14px]">lock</mat-icon> Verrou — {{ concertLockOwner() }}</span>
                } @else {
                  <span class="flex items-center gap-1"><mat-icon class="text-[14px] w-[14px] h-[14px]">lock_open</mat-icon> Verrou libre</span>
                }
              </div>
            </div>

            <div class="p-6 flex-1 flex flex-col gap-5 overflow-y-auto">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-2 transition-colors duration-300" [ngClass]="getBookingCardBorder(withLockBooking().clientA.state)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Client A</span>
                  <div class="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit transition-colors duration-300" [ngClass]="getBookingStateColor(withLockBooking().clientA.state)">
                    @if (isBookingWorking(withLockBooking().clientA.state)) { <mat-icon class="animate-spin text-[12px] w-[12px] h-[12px]">autorenew</mat-icon> }
                    {{ translateBookingState(withLockBooking().clientA.state) }}
                  </div>
                  @if (withLockBooking().clientA.message) {
                    <p class="text-[11px] text-[var(--text-secondary)] leading-tight">{{ withLockBooking().clientA.message }}</p>
                  }
                </div>
                <div class="bg-black/20 border rounded-xl p-4 flex flex-col gap-2 transition-colors duration-300" [ngClass]="getBookingCardBorder(withLockBooking().clientB.state)">
                  <span class="text-sm font-medium text-[var(--text-secondary)]">Client B</span>
                  <div class="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit transition-colors duration-300" [ngClass]="getBookingStateColor(withLockBooking().clientB.state)">
                    @if (isBookingWorking(withLockBooking().clientB.state)) { <mat-icon class="animate-spin text-[12px] w-[12px] h-[12px]">autorenew</mat-icon> }
                    {{ translateBookingState(withLockBooking().clientB.state) }}
                  </div>
                  @if (withLockBooking().clientB.message) {
                    <p class="text-[11px] text-[var(--text-secondary)] leading-tight">{{ withLockBooking().clientB.message }}</p>
                  }
                </div>
              </div>

              <div class="flex gap-3">
                <button (click)="runWithLockBooking()" [disabled]="!canRunWithLockBooking()"
                        class="flex-1 py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  <mat-icon class="text-[var(--primary)]">play_arrow</mat-icon>
                  Lancer la réservation
                </button>
                <button (click)="releaseSeat()" [disabled]="!canReleaseSeat()"
                        title="Simule un paiement échoué : la place redevient disponible"
                        class="px-4 py-3 bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
                  <mat-icon class="text-[16px] w-[16px] h-[16px]">undo</mat-icon>
                  Paiement échoué
                </button>
              </div>

              @if (withLockBooking().done) {
                @if (withLockBooking().clientA.success || withLockBooking().clientB.success) {
                  <div class="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 flex flex-col gap-2 animate-fade-in">
                    <div class="flex items-center gap-2 text-emerald-400 font-bold"><mat-icon>check_circle</mat-icon> Réservation sécurisée</div>
                    <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Un seul client a obtenu la place <strong class="text-white">{{ selectedSeat() }}</strong>.
                      L'autre a été <strong class="text-white">correctement refusé</strong> — aucune double réservation possible.
                      <br><span class="text-xs mt-1 block opacity-70">Utilisez "Paiement échoué" pour libérer la place et relancer le scénario.</span>
                    </div>
                  </div>
                }
              }
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
export class LocksComponent {
  private locksService = inject(LocksService);

  activeTab = signal<'bank' | 'concert'>('bank');

  // --- Compte bancaire ---
  healthBackend = signal(false);
  balance = signal(1000);
  expected = signal(1000);
  noLockStatus = signal<ThreadStatus>({ threadA: 'IDLE', threadB: 'IDLE', done: false });
  withLockStatus = signal<ThreadStatus>({ threadA: 'IDLE', threadB: 'IDLE', done: false });
  lockOwner = signal<string | null>(null);

  isBalanceInconsistent = computed(() => this.balance() < 0 || this.balance() !== this.expected());
  canRunNoLock = computed(() => this.noLockStatus().threadA === 'IDLE' && this.noLockStatus().threadB === 'IDLE' && this.balance() >= 1000);
  canRunWithLock = computed(() => this.withLockStatus().threadA === 'IDLE' && this.withLockStatus().threadB === 'IDLE' && this.balance() >= 1000);

  // --- Concert ---
  selectedSeat = signal('A3');
  seats = signal<Seat[]>([]);
  noLockBooking = signal<BookingStatus>(DEFAULT_BOOKING);
  withLockBooking = signal<BookingStatus>(DEFAULT_BOOKING);
  concertLockOwner = signal<string | null>(null);

  canRunNoLockBooking = computed(() =>
    this.noLockBooking().clientA.state === 'IDLE' && this.noLockBooking().clientB.state === 'IDLE'
  );
  canRunWithLockBooking = computed(() =>
    this.withLockBooking().clientA.state === 'IDLE' && this.withLockBooking().clientB.state === 'IDLE'
  );
  canReleaseSeat = computed(() => {
    const seat = this.seats().find(s => s.id === this.selectedSeat());
    return seat?.status === 'RESERVED' || seat?.status === 'PAID';
  });

  constructor() {
    // Health check
    interval(500).pipe(
      switchMap(() => this.locksService.checkHealth()),
      takeUntilDestroyed()
    ).subscribe(h => this.healthBackend.set(h));

    // Polling compte bancaire
    interval(500).pipe(
      takeUntilDestroyed(),
      filter(() => this.activeTab() === 'bank'),
      switchMap(() => forkJoin({
        account: this.locksService.getBalance(),
        noLock: this.locksService.getNoLockStatus(),
        withLock: this.locksService.getWithLockStatus(),
        lock: this.locksService.getLockStatus(),
      }))
    ).subscribe(res => {
      this.balance.set(res.account.balance);
      this.expected.set(res.account.expected);
      this.noLockStatus.set(res.noLock);
      this.withLockStatus.set(res.withLock);
      this.lockOwner.set(res.lock.owner);
    });

    // Polling concert
    interval(500).pipe(
      takeUntilDestroyed(),
      filter(() => this.activeTab() === 'concert'),
      switchMap(() => forkJoin({
        seats: this.locksService.getSeats(),
        noLockBooking: this.locksService.getNoLockBookingStatus(),
        withLockBooking: this.locksService.getWithLockBookingStatus(),
        concertLock: this.locksService.getConcertLockStatus(this.selectedSeat()),
      }))
    ).subscribe(res => {
      this.seats.set(res.seats);
      this.noLockBooking.set(res.noLockBooking);
      this.withLockBooking.set(res.withLockBooking);
      this.concertLockOwner.set(res.concertLock.owner);
    });
  }

  // --- Actions compte bancaire ---
  resetAccount() { this.locksService.resetAccount().subscribe(); }
  runNoLock() { this.locksService.runNoLock().subscribe(); }
  runWithLock() { this.locksService.runWithLock().subscribe(); }

  // --- Actions concert ---
  selectSeat(seatId: string) { this.selectedSeat.set(seatId); }
  runNoLockBooking() {
    // Deux requêtes HTTP simultanées → deux threads Spring → race condition naturelle
    forkJoin([
      this.locksService.runNoLockBooking(this.selectedSeat(), 'A'),
      this.locksService.runNoLockBooking(this.selectedSeat(), 'B'),
    ]).subscribe();
  }

  runWithLockBooking() {
    // Deux requêtes HTTP simultanées → le premier acquiert le verrou, le second attend
    forkJoin([
      this.locksService.runWithLockBooking(this.selectedSeat(), 'A'),
      this.locksService.runWithLockBooking(this.selectedSeat(), 'B'),
    ]).subscribe();
  }
  releaseSeat() { this.locksService.releaseSeat(this.selectedSeat()).subscribe(); }
  resetConcert() { this.locksService.resetConcert().subscribe(); }

  // --- Helpers grille de sièges ---
  seatsInRow(row: string): Seat[] {
    return this.seats().filter(s => s.id.startsWith(row));
  }

  seatClass(seat: Seat): string {
    const selected = seat.id === this.selectedSeat();
    const ring = selected ? 'ring-2 ring-white scale-105 ' : '';
    switch (seat.status) {
      case 'AVAILABLE': return ring + 'bg-slate-700 text-slate-300 hover:bg-slate-600';
      case 'RESERVED':  return ring + 'bg-orange-500/50 text-orange-200 border border-orange-400/50';
      case 'PAID':      return ring + 'bg-emerald-500/50 text-emerald-200 border border-emerald-400/50';
      default:          return ring + 'bg-slate-700 text-slate-300';
    }
  }

  seatLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE': return 'Disponible';
      case 'RESERVED':  return 'Réservé';
      case 'PAID':      return 'Payé';
      default:          return status;
    }
  }

  // --- Helpers état clients (concert) ---
  translateBookingState(state: string): string {
    switch (state) {
      case 'IDLE':         return 'En attente';
      case 'CHECKING':     return 'Vérification...';
      case 'RESERVING':    return 'Réservation...';
      case 'PAYING':       return 'Paiement...';
      case 'WAITING_LOCK': return 'Attente verrou...';
      case 'SUCCESS':      return 'Confirmé ✓';
      case 'CONFLICT':     return 'Refusé';
      default:             return state;
    }
  }

  getBookingStateColor(state: string): string {
    switch (state) {
      case 'IDLE':         return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
      case 'CHECKING':     return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'RESERVING':    return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'PAYING':       return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'WAITING_LOCK': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'SUCCESS':      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'CONFLICT':     return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:             return 'bg-gray-500/20 text-gray-400';
    }
  }

  getBookingCardBorder(state: string): string {
    switch (state) {
      case 'CHECKING':     return 'border-blue-500/50 bg-blue-500/5';
      case 'RESERVING':    return 'border-orange-500/50 bg-orange-500/5';
      case 'PAYING':       return 'border-purple-500/50 bg-purple-500/5';
      case 'WAITING_LOCK': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'SUCCESS':      return 'border-emerald-500/50 bg-emerald-500/5';
      case 'CONFLICT':     return 'border-rose-500/50 bg-rose-500/5';
      default:             return 'border-[var(--border-main)]';
    }
  }

  isBookingWorking(state: string): boolean {
    return ['CHECKING', 'RESERVING', 'PAYING', 'WAITING_LOCK'].includes(state);
  }

  // --- Helpers état threads (compte bancaire) ---
  translateStatus(status: ThreadState): string {
    switch (status) {
      case 'IDLE':         return 'Inactif';
      case 'READING':      return 'En lecture...';
      case 'DEBITING':     return 'En débit...';
      case 'WAITING_LOCK': return 'Attente du verrou...';
      case 'DONE':         return 'Terminé';
      default:             return status;
    }
  }

  getStatusColor(status: ThreadState): string {
    switch (status) {
      case 'IDLE':         return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
      case 'READING':      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'DEBITING':     return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'WAITING_LOCK': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'DONE':         return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default:             return 'bg-gray-500/20 text-gray-400';
    }
  }

  getCardBorder(status: ThreadState): string {
    switch (status) {
      case 'READING':      return 'border-blue-500/50 bg-blue-500/5';
      case 'DEBITING':     return 'border-orange-500/50 bg-orange-500/5';
      case 'WAITING_LOCK': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'DONE':         return 'border-emerald-500/50 bg-emerald-500/5';
      default:             return 'border-[var(--border-main)]';
    }
  }

  isWorking(status: ThreadState): boolean {
    return status === 'READING' || status === 'DEBITING' || status === 'WAITING_LOCK';
  }
}
