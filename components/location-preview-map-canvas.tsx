// @ts-nocheck
"use client"

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"

interface LocationPreviewMapCanvasProps {
  latitude: number
  longitude: number
  locationName?: string
}

export function LocationPreviewMapCanvas({ latitude, longitude, locationName }: LocationPreviewMapCanvasProps) {
  return (
    <div className="mt-2 h-[200px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <MapContainer
        key={`${latitude}-${longitude}`}
        center={[latitude, longitude]}
        zoom={10}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={false}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          tileSize={256}
          maxZoom={18}
          attribution='&copy; OpenStreetMap'
        />
        <CircleMarker
          center={[latitude, longitude]}
          radius={12}
          weight={2}
          opacity={0.9}
          fillOpacity={0.7}
          color="#22d3ee"
          fillColor="#f472b6"
        >
          {locationName && (
            <Popup>
              <div className="text-sm font-medium">{locationName}</div>
              <div className="text-xs text-gray-500">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </div>
            </Popup>
          )}
        </CircleMarker>
      </MapContainer>
    </div>
  )
}
