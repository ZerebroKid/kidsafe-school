/**
 * Patches TS2786 for react-native-maps components.
 * Same root cause: class component type mismatch with @types/react >=18.2.
 */
declare module 'react-native-maps' {
  import type {FC, ReactNode} from 'react';

  interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  interface LatLng {
    latitude: number;
    longitude: number;
  }

  interface MapViewProps {
    style?: any;
    region?: Region;
    initialRegion?: Region;
    showsUserLocation?: boolean;
    followsUserLocation?: boolean;
    children?: ReactNode;
    [key: string]: any;
  }

  interface MarkerProps {
    coordinate: LatLng;
    title?: string;
    description?: string;
    pinColor?: string;
    children?: ReactNode;
    [key: string]: any;
  }

  const MapView: FC<MapViewProps>;
  const Marker: FC<MarkerProps>;

  export default MapView;
  export {Marker};
  export type {Region, LatLng, MapViewProps, MarkerProps};
}
