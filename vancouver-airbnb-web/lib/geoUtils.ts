import { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export interface NeighbourhoodGeoJSON extends FeatureCollection {
  features: Array<Feature<Geometry, { neighbourhood: string }>>;
}

export function calculateCentroid(coordinates: Position[][]): { lat: number; lng: number } {
  let xSum = 0;
  let ySum = 0;
  let len = 0;

  // Handle MultiPolygon or Polygon. GeoJSON Polygon coordinates are Position[][].
  // MultiPolygon would be Position[][][].
  // We'll flatten everything to a list of points for a simple average (Centroid of vertices).
  // Note: This is an approximation. True centroid requires area weighting.
  // Given neighbourhood shapes, this is usually acceptable for a UI map center.

  const points: Position[] = [];

  const flatten = (coords: any[]) => {
    if (typeof coords[0] === 'number') {
      points.push(coords as Position);
    } else {
      coords.forEach(flatten);
    }
  };

  flatten(coordinates);

  points.forEach(([lng, lat]) => {
    xSum += lng;
    ySum += lat;
    len++;
  });

  return {
    lat: ySum / len,
    lng: xSum / len,
  };
}

export function getNeighbourhoodCentroid(
  geoJSON: NeighbourhoodGeoJSON,
  neighbourhoodName: string
): { lat: number; lng: number } | null {
  const feature = geoJSON.features.find(
    (f) => f.properties.neighbourhood === neighbourhoodName
  );

  if (!feature || !feature.geometry) {
    return null;
  }

  const geometry = feature.geometry;
  
  if (geometry.type === 'Polygon') {
    return calculateCentroid(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return calculateCentroid(geometry.coordinates as any);
  }

  return null;
}

