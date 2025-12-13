"use client";

import { NeighbourhoodGeoJSON, getNeighbourhoodCentroid } from "@/lib/geoUtils";
import { Feature } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

interface Props {
  selectedNeighbourhood?: string;
  onSelectNeighbourhood: (name: string, lat: number, lng: number) => void;
  geoJsonData: NeighbourhoodGeoJSON | null;
}

function MapUpdater({
  selectedNeighbourhood,
  geoJsonData,
}: {
  selectedNeighbourhood?: string;
  geoJsonData: NeighbourhoodGeoJSON | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedNeighbourhood && geoJsonData) {
      const centroid = getNeighbourhoodCentroid(
        geoJsonData,
        selectedNeighbourhood
      );
      if (centroid) {
        map.flyTo([centroid.lat, centroid.lng], 13);
      }
    }
  }, [selectedNeighbourhood, geoJsonData, map]);

  return null;
}

export default function NeighbourhoodMap({
  selectedNeighbourhood,
  onSelectNeighbourhood,
  geoJsonData,
}: Props) {
  const onEachFeature = (
    feature: Feature<any, { neighbourhood: string }>,
    layer: L.Layer
  ) => {
    const name = feature.properties.neighbourhood;

    // Bind tooltip
    layer.bindTooltip(name, {
      permanent: false,
      direction: "center",
      className: "neighbourhood-label",
    });

    layer.on({
      click: () => {
        if (geoJsonData) {
          const centroid = getNeighbourhoodCentroid(geoJsonData, name);
          if (centroid) {
            onSelectNeighbourhood(name, centroid.lat, centroid.lng);
          }
        }
      },
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: "#666",
          dashArray: "",
          fillOpacity: 0.7,
        });
        l.bringToFront();
      },
      mouseout: (e) => {
        const l = e.target;
        if (geoJsonData) {
          const isSelected = name === selectedNeighbourhood;
          l.setStyle({
            fillColor: isSelected ? "#3b82f6" : "#3388ff",
            weight: isSelected ? 3 : 1,
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: isSelected ? 0.6 : 0.3,
          });
        }
      },
    });
  };

  const style = (
    feature: Feature<any, { neighbourhood: string }> | undefined
  ) => {
    if (!feature) return {};
    const isSelected =
      feature.properties.neighbourhood === selectedNeighbourhood;
    return {
      fillColor: isSelected ? "#3b82f6" : "#3388ff",
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: isSelected ? 0.6 : 0.3,
    };
  };

  if (!geoJsonData) {
    return (
      <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <MapContainer
        center={[49.25, -123.12]} // Initial center
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={JSON.stringify(geoJsonData) + selectedNeighbourhood} // Force re-render to apply styles
          data={geoJsonData}
          style={style as any} // Leaflet type mismatch with geojson types sometimes
          onEachFeature={onEachFeature as any}
        />
        <MapUpdater
          selectedNeighbourhood={selectedNeighbourhood}
          geoJsonData={geoJsonData}
        />
      </MapContainer>
    </div>
  );
}
