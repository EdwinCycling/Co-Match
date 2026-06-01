import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type ProviderLocationMapProps = {
  center: [number, number];
  radius: number;
  mapType: 'street' | 'satellite';
  zoom?: number;
  zoomControl?: boolean;
  fillOpacity?: number;
  weight?: number;
};

function MapUpdater({ center, zoom = 13 }: { center: [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  }, [center, map, zoom]);

  return null;
}

export default function ProviderLocationMap({
  center,
  radius,
  mapType,
  zoom = 13,
  zoomControl = true,
  fillOpacity = 0.25,
  weight = 2,
}: ProviderLocationMapProps) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl={zoomControl}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url={
          mapType === 'street'
            ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        }
      />
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: 'var(--color-primary)',
          fillColor: 'var(--color-primary)',
          fillOpacity,
          weight,
        }}
      />
      <MapUpdater center={center} zoom={zoom + (zoom >= 15 ? 0 : 1)} />
    </MapContainer>
  );
}
