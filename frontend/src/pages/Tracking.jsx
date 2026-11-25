import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { MapPin, Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useFleet } from "../context/FleetContext";
import EmptyState from "../components/EmptyState";

const center = [12.9716, 77.5946];
const markerColor = { active: "#2563eb", idle: "#64748b", offline: "#ef4444" };

export default function Tracking() {
  const { vehicles, connection, loading } = useFleet();
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const tracked = useMemo(() => vehicles.filter((vehicle) => vehicle.latest_telemetry && vehicle.vehicle_number.toLowerCase().includes(query.toLowerCase())), [vehicles, query]);
  const focused = selected || tracked.find((vehicle) => vehicle.latest_telemetry);
  return <>
    <PageHeader title="Live vehicle tracking" description="Live simulator positions and vehicle telemetry on the map." action={<div className="live-pill"><span className={`connection-dot ${connection === "live" ? "online" : ""}`} />{connection === "live" ? "Live connection" : "Reconnecting"}</div>} />
    <div className="tracking-layout">
      <aside className="panel tracking-list">
        <div className="tracking-list-header"><strong>Fleet vehicles</strong><span>{tracked.length} tracked</span></div>
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle ID" /></label>
        <div className="tracking-vehicle-list">{tracked.map((vehicle) => <button key={vehicle.id} className={`tracking-vehicle ${focused?.id === vehicle.id ? "selected" : ""}`} onClick={() => setSelected(vehicle)}>
          <span className="vehicle-mini-icon"><MapPin size={16} /></span><span className="tracking-vehicle-copy"><strong>{vehicle.vehicle_number}</strong><small>{vehicle.latest_telemetry.speed.toFixed(0)} km/h · {vehicle.latest_telemetry.battery_percentage.toFixed(0)}% battery</small></span><i className={`map-status-dot ${vehicle.status}`} />
        </button>)}{!tracked.length && <EmptyState title={loading ? "Loading vehicles" : "No tracked vehicles"} />}</div>
      </aside>
      <section className="map-panel panel">
        <MapContainer center={center} zoom={12} scrollWheelZoom className="fleet-map">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {tracked.map((vehicle) => <CircleMarker key={vehicle.id} center={[vehicle.latest_telemetry.latitude, vehicle.latest_telemetry.longitude]} radius={focused?.id === vehicle.id ? 9 : 6} pathOptions={{ color: "#fff", weight: 2, fillColor: markerColor[vehicle.status] || "#64748b", fillOpacity: 0.95 }} eventHandlers={{ click: () => setSelected(vehicle) }}>
            <Popup><strong>{vehicle.vehicle_number}</strong><br />{vehicle.status} · {vehicle.latest_telemetry.speed.toFixed(0)} km/h</Popup>
          </CircleMarker>)}
        </MapContainer>
        <div className="map-legend"><span><i className="legend-active" />Active</span><span><i className="legend-idle" />Idle</span><span><i className="legend-offline" />Offline</span></div>
        {focused && <div className="map-detail-card"><button className="detail-close" onClick={() => setSelected(null)} aria-label="Close vehicle detail">×</button><div className="map-detail-title"><div className="vehicle-mini-icon"><MapPin size={16} /></div><div><strong>{focused.vehicle_number}</strong><small>{focused.model}</small></div><StatusBadge status={focused.status} /></div><div className="map-detail-grid"><div><span>Battery</span><strong>{focused.latest_telemetry.battery_percentage.toFixed(1)}%</strong></div><div><span>Speed</span><strong>{focused.latest_telemetry.speed.toFixed(1)} km/h</strong></div><div><span>Coordinates</span><strong>{focused.latest_telemetry.latitude.toFixed(4)}, {focused.latest_telemetry.longitude.toFixed(4)}</strong></div></div></div>}
      </section>
    </div>
    <p className="map-attribution-note">Map tiles © OpenStreetMap contributors. Vehicle coordinates are simulated.</p>
  </>;
}
