import { useEffect, useState } from "react";
import { BatteryCharging, Thermometer, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useFleet } from "../context/FleetContext";
import { api, getErrorMessage } from "../services/api";

export default function Battery() {
  const { vehicles, summary, lowBatteryThreshold } = useFleet();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    api.get("/api/analytics/battery", { params: { days: 30 } })
      .then(({ data }) => setHistory(data))
      .catch((requestError) => setHistoryError(getErrorMessage(requestError)))
      .finally(() => setHistoryLoading(false));
  }, []);
  const avgTemperature = vehicles.reduce((total, vehicle) => total + (vehicle.latest_telemetry?.battery_temperature || 0), 0) / (vehicles.filter((vehicle) => vehicle.latest_telemetry).length || 1);
  const avgVoltage = vehicles.reduce((total, vehicle) => total + (vehicle.latest_telemetry?.voltage || 0), 0) / (vehicles.filter((vehicle) => vehicle.latest_telemetry).length || 1);
  return <>
    <PageHeader title="Battery health" description="Monitor battery state of charge, pack temperature, voltage, and fleet trends." />
    <div className="metric-grid metric-grid-three"><MetricCard label="Average state of charge" value={summary ? `${summary.average_battery}%` : "—"} detail="Across latest vehicle samples" icon={BatteryCharging} tone="green" /><MetricCard label="Average pack temperature" value={`${avgTemperature.toFixed(1)}°C`} detail="Latest reported readings" icon={Thermometer} tone="orange" /><MetricCard label="Average voltage" value={`${avgVoltage.toFixed(1)} V`} detail="Latest reported readings" icon={Zap} tone="purple" /></div>
    {historyError && <div className="error-banner">{historyError}</div>}
    {historyLoading && <section className="panel"><div className="empty-state"><strong>Loading battery history…</strong></div></section>}
    {!historyLoading && !historyError && !history.length && <section className="panel"><div className="empty-state"><strong>Battery history will appear after telemetry is stored.</strong></div></section>}
    <div className="chart-grid-two" style={{ display: historyLoading || historyError || !history.length ? "none" : undefined }}>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Battery state-of-charge trend</h2><p>Daily fleet averages and minimum observed charge</p></div><span className="chart-period">30 days</span></div><ResponsiveContainer width="100%" height={280}><AreaChart data={history}><defs><linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.19} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="average_battery" name="Average charge" stroke="#10b981" fill="url(#socFill)" strokeWidth={2} /><Line type="monotone" dataKey="minimum_battery" name="Lowest charge" stroke="#f59e0b" dot={false} strokeWidth={2} /></AreaChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Battery temperature</h2><p>Daily average temperature across reported vehicles</p></div></div><ResponsiveContainer width="100%" height={280}><LineChart data={history}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="average_temperature" name="Avg. temperature °C" stroke="#f59e0b" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></section>
    </div>
    <section className="panel fleet-table-panel battery-table"><div className="panel-heading"><div><h2>Battery status by vehicle</h2><p>{summary?.low_battery_vehicles ?? "—"} vehicles currently below the configured threshold</p></div><span className="threshold-note">Simulation threshold</span></div><div className="table-scroll"><table><thead><tr><th>Vehicle</th><th>Status</th><th>Charge</th><th>Battery temp.</th><th>Voltage</th><th>Rule-based health score</th></tr></thead><tbody>{vehicles.map((vehicle) => { const data = vehicle.latest_telemetry; const health = !data ? "No data" : vehicle.health_score >= 70 ? "Normal" : "Attention"; return <tr key={vehicle.id}><td><strong>{vehicle.vehicle_number}</strong><small className="cell-subtitle">{vehicle.model}</small></td><td><StatusBadge status={vehicle.status} /></td><td><div className="soc-bar"><i style={{ width: `${data?.battery_percentage || 0}%`, background: data?.battery_percentage < lowBatteryThreshold ? "#ef4444" : "#10b981" }} />{data ? `${data.battery_percentage.toFixed(1)}%` : "—"}</div></td><td>{data ? `${data.battery_temperature.toFixed(1)}°C` : "—"}</td><td>{data ? `${data.voltage.toFixed(1)} V` : "—"}</td><td><span className={`health-indicator ${health === "Normal" ? "healthy" : health === "Attention" ? "attention" : ""}`}><i />{health === "No data" ? health : `${vehicle.health_score}/100 · ${health}`}</span></td></tr>; })}</tbody></table></div></section>
    <p className="disclaimer">Alert limits shown here are configurable simulator defaults, not real-world vehicle safety specifications.</p>
  </>;
}
