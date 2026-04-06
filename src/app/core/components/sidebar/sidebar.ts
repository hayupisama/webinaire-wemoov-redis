import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="w-[280px] h-full bg-[var(--bg-surface)] border-r border-[var(--border-main)] flex flex-col fixed left-0 top-0 shadow-2xl shadow-[var(--accent)]/5">
      <div class="p-6 flex flex-col gap-3 relative overflow-hidden border-b border-[var(--border-main)] bg-[var(--bg-main)]/50">
        <!-- Accent Glow -->
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-[var(--accent)]/20 rounded-full blur-3xl"></div>
        
        <img src="logo.png" alt="Wemoov" class="h-8 w-auto object-contain object-left relative z-10" referrerpolicy="no-referrer" />
        <div class="text-xs font-bold text-[var(--accent)] tracking-widest uppercase relative z-10 flex items-center gap-2 mt-1">
          <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
          Redis Platform
        </div>
      </div>

      <nav class="flex-1 px-4 py-6 space-y-3 overflow-y-auto">
        @for (item of navItems; track item.path) {
          <a [routerLink]="item.path"
             routerLinkActive="active-link !bg-[var(--accent)] !text-white shadow-lg shadow-[var(--accent)]/30 border-transparent"
             [routerLinkActiveOptions]="{exact: false}"
             class="flex items-start gap-3 px-4 py-3.5 rounded-[var(--radius-inner)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-all duration-300 border border-transparent group relative overflow-hidden">
            
            <mat-icon class="text-[22px] w-[22px] h-[22px] mt-0.5 relative z-10">{{ item.icon }}</mat-icon>
            <div class="flex-1 flex flex-col relative z-10">
              <span class="font-semibold text-sm">{{ item.label }}</span>
              <span class="text-[10px] uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded w-fit transition-colors duration-300
                           bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20
                           group-[.active-link]:bg-white/20 group-[.active-link]:text-white group-[.active-link]:border-white/30">
                {{ item.badge }}
              </span>
            </div>
          </a>
        }
      </nav>
      
      <div class="p-5 border-t border-[var(--border-main)] bg-[var(--accent)]/5 flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[var(--text-secondary)] font-medium">Statut Redis</span>
          <span class="text-[var(--accent)] font-bold flex items-center gap-1.5 bg-[var(--accent)]/10 px-2 py-1 rounded-md border border-[var(--accent)]/20">
            <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>
            Connecté
          </span>
        </div>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  navItems = [
    { path: '/gateway', label: 'API Gateway', icon: 'router', badge: 'Routing & Cache' },
    { path: '/rate-limiting', label: 'Rate Limiting', icon: 'speed', badge: 'Traffic Control' },
    { path: '/streams', label: 'Event Streams', icon: 'waves', badge: 'Pub/Sub' },
    { path: '/locks', label: 'Distributed Locks', icon: 'lock', badge: 'Concurrency' },
    { path: '/geo', label: 'Geo Spatial', icon: 'location_on', badge: 'Location' },
    { path: '/ttl', label: 'TTL & Eviction', icon: 'timer', badge: 'Memory Mgmt' }
  ];
}
