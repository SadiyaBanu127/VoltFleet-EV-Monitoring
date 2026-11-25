import { useEffect, useState } from "react";
import { CheckCircle2, Database, Moon, Radio, Save, Sun } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { useFleet } from "../context/FleetContext";
import { useTheme } from "../context/ThemeContext";
import { api, getErrorMessage } from "../services/api";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { connection, refresh } = useFleet();
  const [config, setConfig] = useState(null);
  const [thresholds, setThresholds] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/api/settings").then(({ data }) => { setConfig(data); setThresholds(data.thresholds); }).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { const { data } = await api.put("/api/settings/thresholds", thresholds); setConfig(data); setThresholds(data.thresholds); await refresh(); setMessage("Alert thresholds saved for this backend session."); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeader title="Settings" description="Configure the dashboard appearance, simulator rules, and service thresholds." />
    {error && <div className="error-banner">{error}</div>}{message && <div className="success-banner"><CheckCircle2 size={16} />{message}</div>}
    <div className="settings-layout">
      <div className="settings-main">
        <section className="panel settings-section"><div className="panel-heading"><div><h2>Appearance</h2><p>Choose the preferred dashboard color mode.</p></div></div><div className="theme-options"><button className={theme === "light" ? "theme-option chosen" : "theme-option"} onClick={() => setTheme("light")}><Sun size={19} /><span><strong>Light mode</strong><small>Bright and clear workspace</small></span><i /></button><button className={theme === "dark" ? "theme-option chosen" : "theme-option"} onClick={() => setTheme("dark")}><Moon size={19} /><span><strong>Dark mode</strong><small>Low-light interface</small></span><i /></button></div></section>
        <section className="panel settings-section"><div className="panel-heading"><div><h2>Alert thresholds</h2><p>Rules are evaluated for incoming simulated telemetry. Defaults are not safety specifications.</p></div></div><form onSubmit={save} className="threshold-form"><label>Low battery alert (%)<input type="number" min="1" max="50" step="1" required value={thresholds.low_battery_threshold ?? ""} onChange={(event) => setThresholds({ ...thresholds, low_battery_threshold: Number(event.target.value) })} /></label><label>High battery temperature (°C)<input type="number" min="30" max="90" step="1" required value={thresholds.high_temperature_threshold ?? ""} onChange={(event) => setThresholds({ ...thresholds, high_temperature_threshold: Number(event.target.value) })} /></label><label>Overspeed alert (km/h)<input type="number" min="30" max="160" step="1" required value={thresholds.overspeed_threshold ?? ""} onChange={(event) => setThresholds({ ...thresholds, overspeed_threshold: Number(event.target.value) })} /></label><button className="primary-button" disabled={busy || !config}><Save size={15} />{busy ? "Saving…" : "Save thresholds"}</button></form></section>
      </div>
      <aside className="settings-side"><section className="panel settings-section"><div className="panel-heading"><div><h2>System status</h2><p>Service connection overview</p></div></div><div className="system-status-item"><span className="system-icon"><Radio size={17} /></span><div><strong>Live simulator</strong><small>WebSocket telemetry stream</small></div><span className={`system-state ${connection === "live" ? "good" : "bad"}`}>{connection === "live" ? "Connected" : "Offline"}</span></div><div className="system-status-item"><span className="system-icon"><Database size={17} /></span><div><strong>Backend API</strong><small>FastAPI service</small></div><span className={`system-state ${config ? "good" : "bad"}`}>{config ? "Connected" : "Checking"}</span></div><div className="system-info"><span>Simulator interval</span><strong>{config ? `${config.simulator_interval_seconds} seconds` : "—"}</strong></div><div className="system-info"><span>Offline after</span><strong>{config ? `${config.offline_after_seconds} seconds` : "—"}</strong></div><div className="notice-box">This application uses simulated vehicles and is not connected to physical vehicles or Intellicar systems.</div></section></aside>
    </div>
  </>;
}
