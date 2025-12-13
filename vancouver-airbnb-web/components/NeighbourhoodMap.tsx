"use client";

import { NeighbourhoodGeoJSON, getNeighbourhoodCentroid } from "@/lib/geoUtils";
import { Feature, GeoJsonObject, Geometry } from "geojson";
import L from "leaflet";
import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

// Fix Leaflet default icon paths for Next.js production builds
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })
    ._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

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
    feature: Feature<Geometry, { neighbourhood: string }>,
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
          color: "#0a4a35",
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
            fillColor: isSelected ? "#0a4a35" : "#3a8d7f",
            weight: isSelected ? 3 : 1,
            opacity: 1,
            color: "#ffffff",
            dashArray: "3",
            fillOpacity: isSelected ? 0.8 : 0.5,
          });
        }
      },
    });
  };

  const style = (feature: GeoJsonObject, _layer: L.Layer): L.PathOptions => {
    if (!feature || feature.type !== "Feature") {
      return {};
    }
    const typedFeature = feature as Feature<
      Geometry,
      { neighbourhood: string }
    >;
    const isSelected =
      typedFeature.properties.neighbourhood === selectedNeighbourhood;
    return {
      fillColor: isSelected ? "#0a4a35" : "#3a8d7f",
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: "#ffffff",
      dashArray: "3",
      fillOpacity: isSelected ? 0.8 : 0.5,
    };
  };

  if (!geoJsonData) {
    return (
      <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center text-muted-foreground">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border shadow-sm relative z-0">
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
          style={style as unknown as Parameters<typeof GeoJSON>[0]["style"]}
          onEachFeature={
            onEachFeature as unknown as Parameters<
              typeof GeoJSON
            >[0]["onEachFeature"]
          }
        />
        <MapUpdater
          selectedNeighbourhood={selectedNeighbourhood}
          geoJsonData={geoJsonData}
        />
      </MapContainer>
    </div>
  );
}
