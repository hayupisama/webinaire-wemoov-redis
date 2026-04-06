import { Routes } from '@angular/router';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { GatewayComponent } from './features/gateway/gateway.component';
import { RateLimitingComponent } from './features/rate-limiting/rate-limiting.component';
import { StreamsComponent } from './features/streams/streams.component';
import { LocksComponent } from './features/locks/locks.component';
import { GeoComponent } from './features/geo/geo.component';
import { TtlComponent } from './features/ttl/ttl.component';

@Component({
  imports: [MatIconModule],
  template: `
    <div class="p-10 bg-[var(--bg-surface)] rounded-[var(--radius-card)] border-t-[6px] border-t-[var(--accent)] shadow-2xl shadow-[var(--accent)]/10 relative overflow-hidden">
      <!-- Accent Glows -->
      <div class="absolute -right-16 -top-16 w-64 h-64 bg-[var(--accent)]/15 rounded-full blur-[60px] pointer-events-none"></div>
      <div class="absolute -left-16 -bottom-16 w-48 h-48 bg-[var(--accent)]/10 rounded-full blur-[50px] pointer-events-none"></div>
      
      <div class="flex items-center gap-5 mb-8 relative z-10">
        <div class="w-16 h-16 rounded-2xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
          <mat-icon class="scale-150">{{ icon }}</mat-icon>
        </div>
        <h2 class="text-4xl font-heading font-bold text-white tracking-tight">{{ title }}</h2>
      </div>
      
      <p class="text-[var(--text-secondary)] text-xl relative z-10 max-w-3xl leading-relaxed">{{ desc }}</p>
      
      <div class="mt-12 pt-8 border-t border-[var(--border-main)] relative z-10 flex gap-4">
        <button class="px-8 py-3.5 bg-[var(--accent)] text-white font-semibold rounded-xl hover:bg-[#ff6b5a] transition-all shadow-lg shadow-[var(--accent)]/40 flex items-center gap-3 transform hover:-translate-y-0.5">
          <mat-icon>play_circle</mat-icon>
          Lancer la démo
        </button>
        <button class="px-8 py-3.5 bg-[var(--bg-main)] text-[var(--accent)] font-semibold rounded-xl border-2 border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 transition-all flex items-center gap-3">
          <mat-icon>code</mat-icon>
          Voir le code
        </button>
      </div>
    </div>
  `
})
export class DummyDemoComponent {
  route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'];
  desc = this.route.snapshot.data['desc'];
  icon = this.route.snapshot.data['icon'];
}

export const routes: Routes = [
  { path: '', redirectTo: 'gateway', pathMatch: 'full' },
  { path: 'gateway', component: GatewayComponent },
  { path: 'rate-limiting', component: RateLimitingComponent },
  { path: 'streams', component: StreamsComponent },
  { path: 'locks', component: LocksComponent },
  { path: 'geo', component: GeoComponent },
  { path: 'ttl', component: TtlComponent }
];
