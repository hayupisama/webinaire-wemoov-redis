import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './core/components/sidebar/sidebar';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex h-screen w-full overflow-hidden border-t-[6px] border-[var(--accent)] bg-[var(--bg-main)] relative">
      <app-sidebar class="z-20"></app-sidebar>
      <main class="flex-1 ml-[280px] h-full overflow-y-auto p-10 relative z-10">
        <!-- Global background accent glow -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-[var(--accent)]/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div class="max-w-6xl mx-auto relative z-10">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class App {}
