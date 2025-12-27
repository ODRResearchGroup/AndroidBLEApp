export type PhotoGeoPoint = {
  t_ms: number;
  lat: number;
  lon: number;
  accuracy_m?: number;
};

export type PhotoBundle = {
  schema: 'photo_gps_bundle_v1';
  captured_at_ms: number;
  photo: {
    bucket: string;
    path: string;
    contentType: string;
    originalFileName?: string | null;
  };
  point: PhotoGeoPoint | null;
};
