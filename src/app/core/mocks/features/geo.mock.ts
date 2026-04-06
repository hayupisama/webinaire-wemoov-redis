import { HttpRequest } from '@angular/common/http';
import { GeoResult } from '../../../features/geo/geo.service';

const CITIES: Record<string, { x: number, y: number }> = {
  'Lille': { x: 280, y: 50 },
  'Strasbourg': { x: 450, y: 160 },
  'Nice': { x: 430, y: 420 },
  'Marseille': { x: 350, y: 450 },
  'Toulouse': { x: 220, y: 430 },
  'Bordeaux': { x: 120, y: 350 },
  'Nantes': { x: 100, y: 220 },
  'Rennes': { x: 120, y: 170 },
  'Paris': { x: 260, y: 140 },
  'Lyon': { x: 340, y: 300 }
};

// Scale: 1 SVG unit = 2.5 km
const SCALE = 2.5;

export function geoMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  if (url.includes('8087/api/geo/search') && method === 'GET') {
    const urlObj = new URL(url);
    const city = urlObj.searchParams.get('city') || 'Paris';
    const radius = parseFloat(urlObj.searchParams.get('radius') || '300');

    const center = CITIES[city];
    if (!center) {
      return { body: [], delay: 10 };
    }

    const results: GeoResult[] = [];

    for (const [name, coords] of Object.entries(CITIES)) {
      const dx = coords.x - center.x;
      const dy = coords.y - center.y;
      const distanceSvg = Math.sqrt(dx * dx + dy * dy);
      const distanceKm = distanceSvg * SCALE;

      if (distanceKm <= radius) {
        results.push({ name, distance: distanceKm });
      }
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    return { body: results, delay: 15 }; // Fast response to simulate Redis GEO
  }

  return null;
}
