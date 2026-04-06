import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, DecimalPipe } from '@angular/common';
import { GeoService, GeoResult } from './geo.service';
import { interval, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CityPoint {
  name: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-geo',
  standalone: true,
  imports: [MatIconModule, NgClass, DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col">
      <div class="mb-6">
        <h2 class="text-3xl font-heading font-bold text-white">Geo Spatial</h2>
        <p class="text-[var(--text-secondary)] mt-2">Recherchez des points d'intérêt à proximité en utilisant les commandes géospatiales natives de Redis.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        <!-- ZONE GAUCHE : Carte SVG -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden relative">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20 absolute top-0 left-0 right-0 z-10">
            <div class="flex items-center gap-3">
              <mat-icon class="text-[var(--accent)]">map</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Carte (SVG Pur)</h3>
            </div>
          </div>

          <div class="flex-1 flex items-center justify-center bg-[#0f172a] p-6 pt-20 relative overflow-hidden">
            <!-- SVG Map -->
            <svg viewBox="0 0 500 500" class="w-full h-full max-h-[500px] drop-shadow-2xl">
              <!-- Hexagon (France rough outline) -->
              <path d="M 280 20 L 480 150 L 430 450 L 200 480 L 50 300 L 80 100 Z" 
                    fill="#1e293b" stroke="#334155" stroke-width="2" stroke-dasharray="10,10" opacity="0.5" />
              
              <!-- Radius Circle -->
              @if (centerCityPoint()) {
                <circle [attr.cx]="centerCityPoint()?.x" 
                        [attr.cy]="centerCityPoint()?.y" 
                        [attr.r]="radius() / 2.5" 
                        fill="var(--accent)" fill-opacity="0.05" 
                        stroke="var(--accent)" stroke-width="2" stroke-dasharray="8,6" 
                        class="origin-center transition-all duration-500 ease-out"
                        [style.transform-origin]="(centerCityPoint()?.x || 0) + 'px ' + (centerCityPoint()?.y || 0) + 'px'"
                        style="animation: spin 20s linear infinite;" />
              }

              <!-- Cities -->
              @for (city of cities; track city.name) {
                <g (click)="selectCity(city.name)" class="cursor-pointer group">
                  <!-- Pulsing effect for center city -->
                  @if (city.name === selectedCity()) {
                    <circle [attr.cx]="city.x" [attr.cy]="city.y" r="12" fill="var(--accent)" opacity="0.3">
                      <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                    </circle>
                  }
                  
                  <circle [attr.cx]="city.x" [attr.cy]="city.y" 
                          [attr.r]="city.name === selectedCity() ? 8 : 6"
                          [attr.fill]="isActive(city.name) ? '#f05c4b' : '#94a3b8'"
                          class="transition-all duration-300 group-hover:stroke-white group-hover:stroke-2" />
                  
                  <text [attr.x]="city.x + 12" [attr.y]="city.y + 4"
                        [attr.fill]="isActive(city.name) ? '#ffffff' : '#94a3b8'"
                        class="text-sm font-medium transition-colors duration-300 pointer-events-none drop-shadow-md"
                        [ngClass]="{'font-bold text-base': city.name === selectedCity()}">
                    {{ city.name }}
                  </text>
                </g>
              }
            </svg>
          </div>
        </div>

        <!-- ZONE DROITE : Contrôles et résultats -->
        <div class="bg-[var(--bg-surface)] rounded-[var(--radius-card)] border border-[var(--border-main)] flex flex-col overflow-hidden">
          <div class="p-5 border-b border-[var(--border-main)] flex items-center justify-between bg-black/20">
            <div class="flex items-center gap-3">
              <mat-icon class="text-[var(--primary)]">search</mat-icon>
              <h3 class="font-heading font-semibold text-lg">Recherche GEO</h3>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium" [ngClass]="healthBackend() ? 'text-emerald-400' : 'text-rose-400'">
              <div class="w-2 h-2 rounded-full" [ngClass]="healthBackend() ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></div>
              {{ healthBackend() ? 'En ligne' : 'Hors ligne' }}
            </div>
          </div>

          <div class="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
            
            <!-- Controls -->
            <div class="flex flex-col gap-5 bg-black/20 p-5 rounded-xl border border-[var(--border-main)]">
              <div class="flex flex-col gap-2">
                <label for="city-select" class="text-sm font-medium text-[var(--text-secondary)]">Ville centrale</label>
                <div class="relative">
                  <select id="city-select"
                          [ngModel]="selectedCity()" (ngModelChange)="onCityChange($event)"
                          class="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer">
                    @for (city of cities; track city.name) {
                      <option [value]="city.name">{{ city.name }}</option>
                    }
                  </select>
                  <mat-icon class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">expand_more</mat-icon>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex justify-between items-center">
                  <label for="radius-slider" class="text-sm font-medium text-[var(--text-secondary)]">Rayon de recherche</label>
                  <span class="text-[var(--accent)] font-bold bg-[var(--accent)]/10 px-2 py-0.5 rounded text-sm">{{ radius() }} km</span>
                </div>
                <input id="radius-slider" type="range"
                       [ngModel]="radius()" (ngModelChange)="radius.set(+$event)"
                       min="50" max="800" step="10"
                       class="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]">
                <div class="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                  <span>50 km</span>
                  <span>800 km</span>
                </div>
              </div>

              <button (click)="search()" [disabled]="isSearching()"
                      class="mt-2 py-3 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-md">
                @if (isSearching()) {
                  <mat-icon class="animate-spin">autorenew</mat-icon>
                  Recherche...
                } @else {
                  <mat-icon class="text-[var(--primary)]">my_location</mat-icon>
                  Rechercher
                }
              </button>
            </div>

            <!-- Results -->
            <div class="flex-1 flex flex-col gap-3 min-h-[200px]">
              <div class="flex justify-between items-end border-b border-[var(--border-main)] pb-2">
                <h4 class="font-medium text-white flex items-center gap-2">
                  <mat-icon class="text-[18px] w-[18px] h-[18px] text-[var(--accent)]">place</mat-icon>
                  Résultats ({{ results().length }})
                </h4>
                @if (responseTime() > 0) {
                  <span class="text-xs font-mono text-[var(--text-secondary)] bg-black/30 px-2 py-1 rounded border border-[var(--border-main)]">
                    Temps : <span class="text-emerald-400 font-bold">{{ responseTime() }} ms</span>
                  </span>
                }
              </div>

              <div class="flex flex-col gap-2 overflow-y-auto pr-2">
                @for (res of results(); track res.name) {
                  <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">
                    <span class="font-bold text-white flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full" [ngClass]="res.name === selectedCity() ? 'bg-[var(--primary)]' : 'bg-[var(--accent)]'"></span>
                      {{ res.name }}
                      @if (res.name === selectedCity()) {
                        <span class="text-[10px] text-[var(--primary)] uppercase tracking-wider bg-[var(--primary)]/20 px-1.5 py-0.5 rounded ml-1">Centre</span>
                      }
                    </span>
                    <span class="text-[var(--text-secondary)] font-mono">
                      {{ res.distance | number:'1.0-1' }} km
                    </span>
                  </div>
                }
                @if (results().length === 0 && responseTime() > 0) {
                  <div class="text-center p-6 text-sm text-[var(--text-secondary)] italic border border-dashed border-[var(--border-main)] rounded-lg">
                    Aucune ville trouvée dans ce rayon.
                  </div>
                }
              </div>
            </div>

            <!-- Comparatif -->
            <div class="mt-auto p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm flex flex-col gap-2">
              <div class="flex items-center gap-2 text-blue-400 font-bold mb-1">
                <mat-icon class="text-[18px] w-[18px] h-[18px]">speed</mat-icon> Comparatif de performance
              </div>
              <div class="grid grid-cols-1 gap-2 text-blue-200/80">
                <div class="flex items-start gap-2">
                  <mat-icon class="text-[16px] w-[16px] h-[16px] mt-0.5 text-rose-400">storage</mat-icon>
                  <span><strong>Avec PostGIS :</strong> Requête SQL complexe + index spatial B-Tree/GiST.</span>
                </div>
                <div class="flex items-start gap-2">
                  <mat-icon class="text-[16px] w-[16px] h-[16px] mt-0.5 text-emerald-400">memory</mat-icon>
                  <span><strong>Avec Redis :</strong> 1 seule commande <code class="bg-black/40 px-1 py-0.5 rounded text-blue-300 font-mono text-xs">GEOSEARCH</code> ultra-rapide en RAM (Geohash).</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class GeoComponent {
  private geoService = inject(GeoService);

  // Data
  cities: CityPoint[] = [
    { name: 'Lille', x: 280, y: 50 },
    { name: 'Strasbourg', x: 450, y: 160 },
    { name: 'Nice', x: 430, y: 420 },
    { name: 'Marseille', x: 350, y: 450 },
    { name: 'Toulouse', x: 220, y: 430 },
    { name: 'Bordeaux', x: 120, y: 350 },
    { name: 'Nantes', x: 100, y: 220 },
    { name: 'Rennes', x: 120, y: 170 },
    { name: 'Paris', x: 260, y: 140 },
    { name: 'Lyon', x: 340, y: 300 }
  ];

  // State
  healthBackend = signal(false);
  selectedCity = signal('Paris');
  radius = signal(300);
  results = signal<GeoResult[]>([]);
  responseTime = signal(0);
  isSearching = signal(false);

  // Computed
  centerCityPoint = computed(() => this.cities.find(c => c.name === this.selectedCity()));
  activeCityNames = computed(() => new Set(this.results().map(r => r.name)));

  constructor() {
    interval(500).pipe(
      switchMap(() => this.geoService.checkHealth()),
      takeUntilDestroyed()
    ).subscribe(h => this.healthBackend.set(h));

    // Initial search
    setTimeout(() => this.search(), 100);
  }

  isActive(cityName: string): boolean {
    return this.activeCityNames().has(cityName);
  }

  selectCity(cityName: string) {
    this.selectedCity.set(cityName);
    this.search();
  }

  onCityChange(city: string) {
    this.selectedCity.set(city);
    this.search();
  }

  search() {
    this.isSearching.set(true);
    this.geoService.search(this.selectedCity(), this.radius()).subscribe(res => {
      this.results.set(res.results);
      this.responseTime.set(res.responseTime);
      this.isSearching.set(false);
    });
  }
}
