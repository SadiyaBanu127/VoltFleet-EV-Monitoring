import { useEffect, useState } from "react";
import { AlertTriangle, BatteryCharging, Check, Filter, ShieldAlert } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { useFleet } from "../context/FleetContext";
import { api, getErrorMessage } from "../services/api";

export default function Alerts() {
  const { alerts: recent, refresh } = useFleet();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/api/alerts", { params: { limit: 500, ...(filter === "all" ? {} : { status: filter }) } }); setAlerts(data); setError(""); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);
  const acknowledge = async (id) => {
    try { await api.post(`/api/alerts/${id}/acknowledge`); await load(); await refresh(); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  };
  const active = alerts.filter((alert) => alert.status === "active").length;
  return <>
    <PageHeader title="Alerts management" description="Review simulator-generated fleet exceptions and acknowledge resolved events." action={<div className="alert-count-chip"><AlertTriangle size={15} />{active} active</div>} />
    {error && <div className="error-banner"><ShieldAlert size={16} />{error}</div>}
    <section className="panel alerts-table-panel"><div className="table-toolbar"><div className="toolbar-title"><Filter size={16} /><strong>Fleet alerts</strong></div><div className="filter-tabs">{["all", "active", "acknowledged"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All alerts" : item}</button>)}</div><span className="result-count">{alerts.length} events</span></div><div className="table-scroll"><table><thead><tr><th>Priority</th><th>Vehicle</th><th>Alert type</th><th>Details</th><th>Timestamp</th><th>Status</th><th></th></tr></thead><tbody>{alerts.map((alert) => <tr key={alert.id}><td><span className={`priority-pill priority-${alert.severity}`}>{alert.severity}</span></td><td><strong>{alert.vehicle_number}</strong></td><td className="alert-type">{alert.alert_type.replaceAll("_", " ")}</td><td className="alert-message">{alert.message}</td><td>{new Date(alert.created_at).toLocaleString()}</td><td><span className={`alert-status ${alert.status}`}>{alert.status}</span></td><td>{alert.status === "active" && <button className="ack-button" onClick={() => acknowledge(alert.id)} title="Acknowledge alert"><Check size={15} />Acknowledge</button>}</td></tr>)}{!alerts.length && <tr><td colSpan="7" className="empty-table">{loading ? "Loading fleet alerts…" : recent.length ? "No alerts in this filter." : "No alerts generated yet. Threshold conditions will appear here."}</td></tr>}</tbody></table></div></section>
    <div className="alert-rule-grid"><div className="rule-card"><span className="rule-icon red"><BatteryCharging size={17} /></span><div><strong>Low battery</strong><small>Charge below configured threshold</small></div><span className="priority-pill priority-high">High</span></div><div className="rule-card"><span className="rule-icon orange"><AlertTriangle size={17} /></span><div><strong>High battery temperature</strong><small>Temperature above configured threshold</small></div><span className="priority-pill priority-high">High</span></div><div className="rule-card"><span className="rule-icon blue"><ShieldAlert size={17} /></span><div><strong>Overspeed / abnormal reading</strong><small>Speed or voltage outside expected range</small></div><span className="priority-pill priority-medium">Medium</span></div></div>
    <p className="disclaimer">Thresholds are simulator defaults for demonstration, not real-world vehicle safety specifications.</p>
  </>;
}
