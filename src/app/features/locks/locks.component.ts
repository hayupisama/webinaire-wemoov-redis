import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';
import { LocksService, ThreadStatus, ThreadState } from './locks.service';
import { interval, switchMap, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-locks',
  standalone: true,
  imports: [MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-6">
        <h2 class="text-3xl font-heading font-bold text-white">Distributed Locks</h2>
        <p class="text-[var(--text-secondary)] mt-2">Gérez la concurrence entre vos microservices en toute sécurité grâce aux verrous distribués (Redlock).</p>
      </div>

      <!-- ÉLÉMENT CENTRAL : Compte Bancaire -->
      <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] p-6 mb-6 flex justify-between items-center relative overflow-hidden">
        <div class="absolute right-0 top-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] pointer-events-none"></div>

        <div class="relative z-10">
          <h3 class="text-lg font-heading font-semibold text-[var(--text-secondary)] flex items-center gap-2">
            <mat-icon class="text-[var(--primary)]">account_balance</mat-icon>
            Compte #FR001
            <span class="flex items-center gap-1.5 text-sm font-medium ml-2" [ngClass]="healthBackend() ? 'text-emerald-400' : 'text-rose-400'">
              <span class="w-2 h-2 rounded-full" [ngClass]="healthBackend() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
              {{ healthBackend() ? 'En ligne' : 'Hors ligne' }}
            </span>
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
        
        <!-- COLONNE GAUCHE : Sans verrou -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <mat-icon class="text-[var(--accent)]">lock_open</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Sans verrou</h3>
            </div>
          </div>
          
          <div class="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
            <div class="grid grid-cols-2 gap-4">
              <!-- Thread A -->
              <div class="bg-black/20 border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300"
                   [ngClass]="getCardBorder(noLockStatus().threadA)">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Thread A</span>
                <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" 
                     [ngClass]="getStatusColor(noLockStatus().threadA)">
                  @if (isWorking(noLockStatus().threadA)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                  {{ translateStatus(noLockStatus().threadA) }}
                </div>
              </div>
              <!-- Thread B -->
              <div class="bg-black/20 border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300"
                   [ngClass]="getCardBorder(noLockStatus().threadB)">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Thread B</span>
                <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" 
                     [ngClass]="getStatusColor(noLockStatus().threadB)">
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
              <div class="mt-auto p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 flex flex-col gap-2 animate-fade-in">
                <div class="flex items-center gap-2 text-rose-400 font-bold">
                  <mat-icon>warning</mat-icon> ⚠️ Incohérence détectée
                </div>
                <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Les deux threads ont lu le solde à 1000€ en même temps et ont chacun déduit 500€. 
                  Le solde final est de <strong class="text-white">{{ noLockStatus().finalActual }} €</strong> 
                  au lieu de <strong class="text-white">{{ noLockStatus().finalExpected }} €</strong>.
                </div>
              </div>
            }
          </div>
        </div>

        <!-- COLONNE DROITE : Avec verrou Redis -->
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
              <!-- Thread A -->
              <div class="bg-black/20 border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300"
                   [ngClass]="getCardBorder(withLockStatus().threadA)">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Thread A</span>
                <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" 
                     [ngClass]="getStatusColor(withLockStatus().threadA)">
                  @if (isWorking(withLockStatus().threadA)) { <mat-icon class="animate-spin text-[14px] w-[14px] h-[14px]">autorenew</mat-icon> }
                  {{ translateStatus(withLockStatus().threadA) }}
                </div>
              </div>
              <!-- Thread B -->
              <div class="bg-black/20 border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300"
                   [ngClass]="getCardBorder(withLockStatus().threadB)">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Thread B</span>
                <div class="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit transition-colors duration-300" 
                     [ngClass]="getStatusColor(withLockStatus().threadB)">
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
              <div class="mt-auto p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 flex flex-col gap-2 animate-fade-in">
                <div class="flex items-center gap-2 text-emerald-400 font-bold">
                  <mat-icon>check_circle</mat-icon> ✓ Cohérence garantie
                </div>
                <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Le verrou a forcé l'exécution séquentielle. Le solde final est correctement calculé à <strong class="text-white">{{ withLockStatus().finalActual }} €</strong>.
                </div>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class LocksComponent {
  private locksService = inject(LocksService);

  healthBackend = signal(false);
  balance = signal(1000);
  expected = signal(1000);

  noLockStatus = signal<ThreadStatus>({ threadA: 'IDLE', threadB: 'IDLE', done: false });
  withLockStatus = signal<ThreadStatus>({ threadA: 'IDLE', threadB: 'IDLE', done: false });
  lockOwner = signal<string | null>(null);

  isBalanceInconsistent = computed(() => this.balance() < 0 || this.balance() !== this.expected());

  canRunNoLock = computed(() => this.noLockStatus().threadA === 'IDLE' && this.noLockStatus().threadB === 'IDLE' && this.balance() >= 1000);
  canRunWithLock = computed(() => this.withLockStatus().threadA === 'IDLE' && this.withLockStatus().threadB === 'IDLE' && this.balance() >= 1000);

  constructor() {
    interval(500).pipe(
      switchMap(() => this.locksService.checkHealth()),
      takeUntilDestroyed()
    ).subscribe(h => this.healthBackend.set(h));

    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => forkJoin({
        account: this.locksService.getBalance(),
        noLock: this.locksService.getNoLockStatus(),
        withLock: this.locksService.getWithLockStatus(),
        lock: this.locksService.getLockStatus()
      }))
    ).subscribe(res => {
      this.balance.set(res.account.balance);
      this.expected.set(res.account.expected);
      this.noLockStatus.set(res.noLock);
      this.withLockStatus.set(res.withLock);
      this.lockOwner.set(res.lock.owner);
    });
  }

  resetAccount() {
    this.locksService.resetAccount().subscribe();
  }

  runNoLock() {
    this.locksService.runNoLock().subscribe();
  }

  runWithLock() {
    this.locksService.runWithLock().subscribe();
  }

  translateStatus(status: ThreadState): string {
    switch (status) {
      case 'IDLE': return 'Inactif';
      case 'READING': return 'En lecture...';
      case 'DEBITING': return 'En débit...';
      case 'WAITING_LOCK': return 'Attente du verrou...';
      case 'DONE': return 'Terminé';
      default: return status;
    }
  }

  getStatusColor(status: ThreadState): string {
    switch (status) {
      case 'IDLE': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
      case 'READING': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'DEBITING': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'WAITING_LOCK': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'DONE': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  getCardBorder(status: ThreadState): string {
    switch (status) {
      case 'READING': return 'border-blue-500/50 bg-blue-500/5';
      case 'DEBITING': return 'border-orange-500/50 bg-orange-500/5';
      case 'WAITING_LOCK': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'DONE': return 'border-emerald-500/50 bg-emerald-500/5';
      default: return 'border-[var(--border-main)]';
    }
  }

  isWorking(status: ThreadState): boolean {
    return status === 'READING' || status === 'DEBITING' || status === 'WAITING_LOCK';
  }
}
