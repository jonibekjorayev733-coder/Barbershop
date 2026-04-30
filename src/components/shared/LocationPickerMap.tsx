import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationPickerMapProps {
  value: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  className?: string;
}

function MapViewport({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [center, map]);

  return null;
}

function ClickHandler({ onChange }: { onChange: (coords: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

const DEFAULT_CENTER: Coordinates = { lat: 39.7678, lng: 64.4554 };

export function LocationPickerMap({ value, onChange, className }: LocationPickerMapProps) {
  const center = value ?? DEFAULT_CENTER;

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={14} className={className ?? "location-picker-map"} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      <MapViewport center={center} />
      {value ? (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={11}
          pathOptions={{
            color: "#f59e0b",
            fillColor: "#fbbf24",
            fillOpacity: 0.85,
            weight: 3,
          }}
        />
      ) : null}
    </MapContainer>
  );
}
