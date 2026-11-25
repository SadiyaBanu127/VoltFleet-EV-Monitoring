import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Battery, CarFront, Gauge, Radio, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { useFleet } from "../context/FleetContext";
import { api, getErrorMessage } from "../services/api";

const colors = ["#2563eb", "#94a3b8", "#e2e8f0"];

export default function Dashboard() {
  const { summary, alerts, vehicles, connection, lowBatteryThreshold, loading } = useFleet();
  const [trend, setTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState("");
  useEffect(() => {
    api.get("/api/analytics/battery", { params: { days: 7 } })
      .then(({ data }) => setTrend(data))
      .catch((requestError) => setTrendError(getErrorMessage(requestError)))
      .finally(() => setTrendLoading(false));
  }, []);
  const latest = vehicles.filter((vehicle) => vehicle.latest_telemetry).slice(0, 5);

  return <>
    <PageHeader title="Fleet overview" description="Monitor vehicle health and operational activity across your fleet." action={<div className="live-pill"><span className={`connection-dot ${connection === "live" ? "online" : ""}`} />{connection === "live" ? "Simulator connected" : connection === "offline" ? "Backend unavailable" : "Connecting…"}</div>} />
    {loading && <div className="loading-banner">Loading fleet telemetry…</div>}
    <div className="metric-grid">
      <MetricCard label="Total vehicles" value={summary?.total_vehicles ?? "—"} detail="Registered in fleet" icon={CarFront} />
      <MetricCard label="Active vehicles" value={summary?.active_vehicles ?? "—"} detail="Currently in operation" icon={Radio} tone="green" />
      <MetricCard label="Idle vehicles" value={summary?.idle_vehicles ?? "—"} detail="Available for dispatch" icon={Activity} tone="purple" />
      <MetricCard label="Offline vehicles" value={summary?.offline_vehicles ?? "—"} detail="No recent telemetry" icon={Gauge} tone="gray" />
      <MetricCard label="Low battery" value={summary?.low_battery_vehicles ?? "—"} detail="Below configured threshold" icon={Battery} tone="orange" />
      <MetricCard label="Active alerts" value={summary?.active_alerts ?? "—"} detail="Require attention" icon={AlertTriangle} tone="red" />
    </div>
    <div className="dashboard-grid">
      <section className="panel trend-panel">
        <div className="panel-heading"><div><h2>Battery performance</h2><p>Fleet daily average · last 7 days</p></div><Link to="/battery" className="text-link">View battery health</Link></div>
        {trendLoading ? <EmptyState title="Loading battery history" /> : trendError ? <div className="inline-error">{trendError}</div> : trend.length ? <ResponsiveContainer width="100%" height={250}><AreaChart data={trend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <defs><linearGradient id="batteryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="average_battery" name="Avg. battery" stroke="#2563eb" strokeWidth={2.5} fill="url(#batteryFill)" />
        </AreaChart></ResponsiveContainer> : <EmptyState title="Collecting battery history" />}
      </section>
      <section className="panel status-panel">
        <div className="panel-heading"><div><h2>Vehicle status</h2><p>Current fleet distribution</p></div></div>
        {summary?.total_vehicles ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={summary.status_distribution} dataKey="value" innerRadius={55} outerRadius={76} paddingAngle={4} stroke="none">{summary.status_distribution.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{summary.total_vehicles}</strong><span>vehicles</span></div></div><div className="legend-list">{summary.status_distribution.map((item, index) => <div key={item.name}><span className="legend-name"><i style={{ background: colors[index] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></> : <EmptyState title="Waiting for fleet data" />}
      </section>
      <section className="panel vehicle-panel">
        <div className="panel-heading"><div><h2>Live vehicle activity</h2><p>Latest telemetry updates</p></div><Link to="/vehicles" className="text-link">View all vehicles</Link></div>
        <div className="table-scroll"><table><thead><tr><th>Vehicle</th><th>Status</th><th>Battery</th><th>Speed</th><th>Location</th></tr></thead><tbody>
          {latest.map((vehicle) => <tr key={vehicle.id}><td><strong>{vehicle.vehicle_number}</strong><small className="cell-subtitle">{vehicle.model}</small></td><td><StatusBadge status={vehicle.status} /></td><td><div className="battery-cell"><span className={`battery-dot ${vehicle.latest_telemetry.battery_percentage < lowBatteryThreshold ? "low" : ""}`} />{vehicle.latest_telemetry.battery_percentage.toFixed(0)}%</div></td><td>{vehicle.latest_telemetry.speed.toFixed(0)} km/h</td><td>{vehicle.latest_telemetry.latitude.toFixed(3)}, {vehicle.latest_telemetry.longitude.toFixed(3)}</td></tr>)}
          {!latest.length && <tr><td colSpan="5"><EmptyState title={loading ? "Loading vehicle telemetry" : "No telemetry available"} /></td></tr>}
        </tbody></table></div>
      </section>
      <section className="panel alerts-panel">
        <div className="panel-heading"><div><h2>Recent alerts</h2><p>Fleet events that need attention</p></div><Link to="/alerts" className="text-link">All alerts</Link></div>
        <div className="recent-alert-list">{alerts.slice(0, 5).map((alert) => <div className="recent-alert" key={alert.id}><div className={`alert-symbol severity-${alert.severity}`}><Zap size={15} /></div><div className="recent-alert-copy"><strong>{alert.vehicle_number} · {alert.alert_type.replaceAll("_", " ")}</strong><span>{alert.message}</span></div><small>{new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>)}{!alerts.length && <EmptyState title={loading ? "Loading alerts" : "All clear"} detail={loading ? "Fetching recent fleet events." : "No recent active alerts."} />}</div>
      </section>
    </div>
  </>;
}
