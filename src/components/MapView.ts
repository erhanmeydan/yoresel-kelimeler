import L from 'leaflet';
import { addOsmTileLayer, createLeafletMap, createMarkerIcon } from '../utils/geo';
import type { Region } from '../types/models';

export interface MapViewCallbacks {
  onRegionClick: (region: Region) => void;
}

export class MapView {
  private map: L.Map;
  private markers = new Map<string, L.Marker>();

  constructor(container: HTMLElement, private callbacks: MapViewCallbacks) {
    this.map = createLeafletMap(container);
    addOsmTileLayer(this.map);
  }

  setRegions(regions: Region[]): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();

    for (const region of regions) {
      const [lat, lng] = [region.geoPoint.latitude, region.geoPoint.longitude];
      const marker = L.marker([lat, lng], { icon: createMarkerIcon() })
        .addTo(this.map)
        .on('click', () => this.callbacks.onRegionClick(region));
      this.markers.set(region.id, marker);
    }
  }

  highlightRegion(regionId: string | null): void {
    for (const [id, m] of this.markers) {
      const icon = createMarkerIcon(id === regionId);
      m.setIcon(icon);
    }
    if (regionId) {
      const region = [...this.markers.entries()].find(([id]) => id === regionId)?.[1];
      if (region) region.openPopup();
    }
  }

  destroy(): void {
    this.map.remove();
  }
}
