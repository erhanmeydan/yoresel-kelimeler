import L from 'leaflet';

export function createMarkerIcon(active = false): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-dot ${active ? 'active' : ''}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function createLeafletMap(container: HTMLElement): L.Map {
  return L.map(container, {
    center: [39.0, 35.0],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12,
    scrollWheelZoom: true,
  });
}

export function addOsmTileLayer(map: L.Map): void {
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
  }).addTo(map);
}
