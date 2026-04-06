import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, DatePipe } from '@angular/common';
import { StreamsService, StreamMessage } from './streams.service';
import { interval, switchMap, forkJoin, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-streams',
  standalone: true,
  imports: [MatIconModule, NgClass, DatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-6">
        <h2 class="text-3xl font-heading font-bold text-white">Event Streams</h2>
        <p class="text-[var(--text-secondary)] mt-2">Messagerie asynchrone et découplage avec Redis Streams (Pub/Sub persistant).</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        <!-- PANNEAU GAUCHE : Producteur -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <mat-icon class="text-[var(--primary)]">publish</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Producteur</h3>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium" [ngClass]="producerHealth() ? 'text-emerald-400' : 'text-rose-400'">
              <div class="w-2 h-2 rounded-full" [ngClass]="producerHealth() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></div>
              {{ producerHealth() ? 'En ligne' : 'Hors ligne' }}
            </div>
          </div>

          <div class="p-6 flex-1 flex flex-col gap-6">
            <form [formGroup]="publishForm" (ngSubmit)="publish()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label for="type" class="text-sm font-medium text-[var(--text-secondary)]">Type d'événement</label>
                <input id="type" type="text" formControlName="type" placeholder="ex: ORDER_CREATED"
                       class="w-full bg-black/20 border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors">
              </div>
              
              <div class="flex flex-col gap-2">
                <label for="payload" class="text-sm font-medium text-[var(--text-secondary)]">Payload</label>
                <textarea id="payload" formControlName="payload" placeholder="Données de l'événement..." rows="3"
                          class="w-full bg-black/20 border border-[var(--border-main)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"></textarea>
              </div>

              <div class="mt-2 flex gap-2">
                <button type="submit" [disabled]="publishForm.invalid || isPublishing()"
                        class="flex-1 py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                  @if (isPublishing()) {
                    <mat-icon class="animate-spin">autorenew</mat-icon>
                  } @else {
                    <mat-icon class="text-[var(--primary)]">send</mat-icon>
                  }
                  Publier
                </button>
                <button type="button" (click)="toggleAutoPublish()"
                        class="flex-1 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md"
                        [ngClass]="isAutoPublishing() ? 'bg-[var(--primary)] text-white hover:bg-[#5068b0]' : 'bg-white text-slate-900 hover:bg-gray-200'">
                  @if (isAutoPublishing()) {
                    <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    Arrêter
                  } @else {
                    <mat-icon class="text-[var(--primary)]">play_circle</mat-icon>
                    Auto
                  }
                </button>
              </div>
            </form>

            <div class="mt-auto pt-6 border-t border-[var(--border-main)]">
              <div class="p-4 rounded-xl bg-black/20 border border-[var(--border-main)] flex justify-between items-center">
                <span class="text-sm font-medium text-[var(--text-secondary)]">Messages dans le stream</span>
                <span class="text-2xl font-bold text-[var(--primary)]">{{ streamMessages().length }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- PANNEAU CENTRAL : Stream Redis -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden relative">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <mat-icon class="text-[var(--accent)]">waves</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Journal du Stream</h3>
              <span class="relative flex h-3 w-3 ml-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]"></span>
              </span>
            </div>

            <div class="flex items-center gap-3">
              <div class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 transition-colors duration-300"
                   [ngClass]="pendingCount() > 3 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-black/40 text-[var(--text-secondary)] border-[var(--border-main)]'">
                En attente : {{ pendingCount() }}
                @if (pendingCount() > 3) {
                  <mat-icon class="text-[14px] w-[14px] h-[14px]">warning</mat-icon>
                }
              </div>
              <button (click)="reset()" title="Vider le stream"
                      class="text-[var(--text-secondary)] hover:text-white transition-colors">
                <mat-icon class="text-[18px] w-[18px] h-[18px]">refresh</mat-icon>
              </button>
            </div>
          </div>

          <div class="p-4 flex-1 overflow-y-auto flex flex-col gap-3 bg-black/10">
            @for (msg of streamMessages(); track msg.id) {
              <div class="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-main)] shadow-sm flex flex-col gap-2 text-sm animate-fade-in">
                <div class="flex justify-between items-center border-b border-[var(--border-main)] pb-2 mb-1">
                  <span class="text-xs font-mono text-[var(--text-secondary)]">{{ msg.id }}</span>
                  <span class="text-xs text-[var(--text-secondary)]">{{ msg.timestamp | date:'HH:mm:ss.SSS' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold">{{ msg.type }}</span>
                </div>
                <div class="font-mono text-[var(--text-secondary)] mt-1 truncate" [title]="msg.payload">
                  {{ msg.payload }}
                </div>
              </div>
            }
            @if (streamMessages().length === 0) {
              <div class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
                <mat-icon class="text-4xl mb-2">receipt_long</mat-icon>
                <p>Le stream est vide</p>
              </div>
            }
          </div>
        </div>

        <!-- PANNEAU DROIT : Consommateur -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <mat-icon class="text-emerald-400">memory</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Consommateur</h3>
            </div>
            
            @if (consumerHealth()) {
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> En ligne
              </span>
            } @else {
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-rose-400"></span> Hors ligne
              </span>
            }
          </div>

          <div class="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
            @for (msg of processedMessages(); track msg.id) {
              <div class="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-2 text-sm animate-fade-in">
                <div class="flex justify-between items-center">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">{{ msg.type }}</span>
                  <span class="text-emerald-500 font-bold text-xs flex items-center gap-1">
                    ACK <mat-icon class="text-[14px] w-[14px] h-[14px]">check</mat-icon>
                  </span>
                </div>
                <div class="font-mono text-[var(--text-secondary)] truncate" [title]="msg.payload">
                  {{ msg.payload }}
                </div>
              </div>
            }
            @if (processedMessages().length === 0) {
              <div class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
                <mat-icon class="text-4xl mb-2">hourglass_empty</mat-icon>
                <p>En attente de messages...</p>
              </div>
            }
          </div>

          <div class="p-6 border-t border-[var(--border-main)] flex flex-col gap-4">
            <div class="p-4 rounded-xl bg-black/20 border border-[var(--border-main)] flex justify-between items-center">
              <span class="text-sm font-medium text-[var(--text-secondary)]">Messages traités</span>
              <span class="text-2xl font-bold text-emerald-400">{{ processedMessages().length }}</span>
            </div>
            
            <div class="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
              <mat-icon class="text-[16px] w-[16px] h-[16px] mt-0.5">info</mat-icon>
              <p>Pour simuler une panne et voir l'accumulation des messages, exécutez : <br><code class="bg-black/40 px-1 py-0.5 rounded text-blue-200 mt-1 inline-block font-mono">docker stop redis-demo-consumer</code></p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class StreamsComponent {
  private fb = inject(FormBuilder);
  private streamsService = inject(StreamsService);

  publishForm = this.fb.nonNullable.group({
    type: ['ORDER_CREATED', Validators.required],
    payload: ['{"orderId": 12345, "amount": 99.99}', Validators.required]
  });

  isPublishing = signal(false);
  isAutoPublishing = signal(false);

  streamMessages = signal<StreamMessage[]>([]);
  processedMessages = signal<StreamMessage[]>([]);
  producerHealth = signal(false);
  consumerHealth = signal(false);

  pendingCount = computed(() => {
    // Différence entre les messages dans le stream et ceux traités
    return Math.max(0, this.streamMessages().length - this.processedMessages().length);
  });

  private readonly AUTO_PUBLISH_INTERVAL_MS = 800;

  constructor() {
    // Polling Stream & Processed Messages (1s)
    interval(1000).pipe(
      takeUntilDestroyed(),
      switchMap(() => forkJoin({
        stream: this.streamsService.getStream(),
        processed: this.streamsService.getProcessedMessages()
      }))
    ).subscribe(res => {
      this.streamMessages.set(res.stream);
      this.processedMessages.set(res.processed);
    });

    // Polling Producer Health (500ms)
    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.streamsService.getProducerHealth())
    ).subscribe(health => this.producerHealth.set(health));

    // Polling Consumer Health (500ms)
    interval(500).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.streamsService.getConsumerHealth())
    ).subscribe(health => this.consumerHealth.set(health));

    // Publication automatique
    interval(this.AUTO_PUBLISH_INTERVAL_MS).pipe(
      takeUntilDestroyed(),
      filter(() => this.isAutoPublishing() && this.publishForm.valid),
      switchMap(() => {
        const { type, payload } = this.publishForm.getRawValue();
        return this.streamsService.publishMessage(type, payload);
      })
    ).subscribe(success => {
      if (success) {
        const currentPayload = this.publishForm.getRawValue().payload;
        const currentId = parseInt(currentPayload.match(/\d+/)?.[0] || '12345', 10);
        this.publishForm.patchValue({ payload: `{"orderId": ${currentId + 1}, "amount": 99.99}` });
      }
    });
  }

  toggleAutoPublish() {
    this.isAutoPublishing.update(v => !v);
  }

  reset() {
    this.isAutoPublishing.set(false);
    this.streamsService.resetStream().subscribe(() => {
      this.streamMessages.set([]);
      this.processedMessages.set([]);
    });
  }

  publish() {
    if (this.publishForm.invalid) return;

    this.isPublishing.set(true);
    const { type, payload } = this.publishForm.getRawValue();

    this.streamsService.publishMessage(type, payload).subscribe(success => {
      this.isPublishing.set(false);
      if (success) {
        const currentId = parseInt(payload.match(/\d+/)?.[0] || '12345', 10);
        this.publishForm.patchValue({ payload: `{"orderId": ${currentId + 1}, "amount": 99.99}` });
      }
    });
  }
}
