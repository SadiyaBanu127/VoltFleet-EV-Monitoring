import { useEffect, useState } from "react";
import { Activity, Gauge, Thermometer, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { useFleet } from "../context/FleetContext";
import { api, getErrorMessage } from "../services/api";

export default function Analytics() {
  const { summary, vehicles } = useFleet();
  const [data, setData] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    api.get("/api/analytics/battery", { params: { days } })
      .then(({ data: result }) => { setData(result); setError(""); })
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [days]);
  const activePercent = summary?.total_vehicles ? Math.round((summary.active_vehicles / summary.total_vehicles) * 100) : 0;
  const utilization = vehicles.length ? Math.round(vehicles.reduce((n, vehicle) => n + (vehicle.status === "active" ? 1 : 0), 0) * 100 / vehicles.length) : 0;
  return <>
    <PageHeader title="Fleet analytics" description="Operational insights based on telemetry collected by the vehicle simulator." action={<select className="select-control period-select" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>} />
    <div className="metric-grid metric-grid-three"><MetricCard label="Fleet utilization" value={`${utilization}%`} detail="Vehicles currently active" icon={Activity} tone="green" /><MetricCard label="Average vehicle speed" value={summary ? `${summary.average_speed} km/h` : "—"} detail="Across latest telemetry" icon={Gauge} tone="blue" /><MetricCard label="Active fleet share" value={`${activePercent}%`} detail="Live status distribution" icon={TrendingUp} tone="purple" /></div>
    {error && <div className="error-banner">{error}</div>}
    {loading ? <section className="panel"><EmptyState title="Loading analytics" /></section> : error ? null : data.length ? <div className="analytics-chart-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Battery performance</h2><p>Daily average and fleet minimum (%)</p></div></div><ResponsiveContainer width="100%" height={270}><AreaChart data={data}><defs><linearGradient id="analyticsBattery" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="average_battery" name="Average battery" stroke="#2563eb" fill="url(#analyticsBattery)" strokeWidth={2} /><Line type="monotone" dataKey="minimum_battery" name="Minimum battery" stroke="#f59e0b" dot={false} /></AreaChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Temperature trend</h2><p>Daily average battery temperature (°C)</p></div><Thermometer size={18} className="muted-icon" /></div><ResponsiveContainer width="100%" height={270}><LineChart data={data}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="average_temperature" name="Temperature °C" stroke="#f97316" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></section>
      <section className="panel chart-panel wide-chart"><div className="panel-heading"><div><h2>Speed and fleet activity</h2><p>Average speed (km/h) by day</p></div></div><ResponsiveContainer width="100%" height={230}><BarChart data={data}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip /><Bar dataKey="average_speed" name="Average speed" fill="#7c3aed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></section>
    </div> : <section className="panel"><EmptyState title="Building analytics history" detail="Charts populate as the simulator records telemetry over time." /></section>}
    <div className="insight-strip"><TrendingUp size={18} /><div><strong>Fleet utilization insight</strong><span>{activePercent}% of vehicles are active at this moment. Activity is calculated from each vehicle’s latest simulator status; this is a current snapshot, not a predictive model.</span></div></div>
  </>;
}
