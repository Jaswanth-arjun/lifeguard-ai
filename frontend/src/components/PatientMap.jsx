import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function PatientMap({
  patientLat,
  patientLng,
  hospital,
  routeCoords,
  className = "",
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const center = useMemo(() => {
    if (patientLat != null && patientLng != null) return [patientLat, patientLng];
    return [40.7128, -74.006];
  }, [patientLat, patientLng]);

  const boundsPoints = useMemo(() => {
    const pts = [[patientLat ?? center[0], patientLng ?? center[1]]];
    if (hospital) pts.push([hospital.latitude, hospital.longitude]);
    return pts;
  }, [patientLat, patientLng, hospital, center]);

  const linePositions = routeCoords?.length ? routeCoords : null;

  if (!ready) {
    return (
      <div
        className={`leaflet-container ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface2)",
          color: "var(--muted)",
        }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className={`leaflet-container ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={boundsPoints} />
      <Marker position={[patientLat ?? center[0], patientLng ?? center[1]]}>
        <Popup>Patient (live location)</Popup>
      </Marker>
      {hospital && (
        <Marker position={[hospital.latitude, hospital.longitude]}>
          <Popup>{hospital.name}</Popup>
        </Marker>
      )}
      {linePositions && (
        <Polyline positions={linePositions} color="#3d9cf5" weight={5} opacity={0.85} />
      )}
    </MapContainer>
  );
}
