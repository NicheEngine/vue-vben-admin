export type Point = number[];

export interface Coordinate {
  x: number;
  y: number;
  z?: number;
}

export interface Location {
  longitude: number;
  latitude: number;
  height?: number;
}

export interface Position {
  lng: number;
  lat: number;
  het?: number;
}
