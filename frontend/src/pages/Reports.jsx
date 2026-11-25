import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import PageHeader from "../components/PageHeader";
import { useFleet } from "../context/FleetContext";
import { api, getErrorMessage } from "../services/api";

async function downloadFile(path, name) {
  const { data } = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { vehicles, summary } = useFleet();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const exportBackend = async (kind) => {
    setBusy(kind); setError("");
    try { await downloadFile(`/api/reports/fleet.${kind}`, `volt-fleet-report.${kind}`); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(""); }
  };
  const generateVehiclePdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18); pdf.text("EV Fleet Vehicle Report", 14, 20);
    pdf.setFontSize(9); pdf.text(`Generated ${new Date().toLocaleString()} · simulator data`, 14, 28);
    pdf.setFontSize(10);
    let y = 40;
    vehicles.forEach((vehicle) => {
      if (y > 275) { pdf.addPage(); y = 18; }
      const telemetry = vehicle.latest_telemetry;
      pdf.text(`${vehicle.vehicle_number} | ${vehicle.status} | Battery ${telemetry ? `${telemetry.battery_percentage.toFixed(1)}%` : "n/a"} | Speed ${telemetry ? `${telemetry.speed.toFixed(1)} km/h` : "n/a"} | Temp ${telemetry ? `${telemetry.battery_temperature.toFixed(1)} C` : "n/a"}`, 14, y);
      y += 8;
    });
    pdf.save("vehicle-detail-report.pdf");
  };
  const summaryCards = [["Total vehicles", summary?.total_vehicles ?? "—"], ["Active vehicles", summary?.active_vehicles ?? "—"], ["Average battery", summary ? `${summary.average_battery}%` : "—"], ["Active alerts", summary?.active_alerts ?? "—"]];
  return <>
    <PageHeader title="Fleet reports" description="Generate and download current fleet snapshots for sharing and review." />
    {error && <div className="error-banner">{error}</div>}
    <section className="report-summary panel"><div className="panel-heading"><div><h2>Fleet summary preview</h2><p>Current snapshot · values refresh with latest telemetry</p></div><span className="live-pill">Updated just now</span></div><div className="report-summary-grid">{summaryCards.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
    <div className="report-card-grid">
      <article className="report-card"><div className="report-icon csv"><FileSpreadsheet size={22} /></div><span className="report-format">CSV · fleet-wide</span><h2>Fleet summary CSV</h2><p>Download each vehicle’s latest status, battery, speed, temperature, voltage, and active alert count.</p><button className="secondary-button" disabled={busy !== ""} onClick={() => exportBackend("csv")}><Download size={15} />{busy === "csv" ? "Preparing…" : "Download CSV"}</button></article>
      <article className="report-card"><div className="report-icon pdf"><FileText size={22} /></div><span className="report-format">PDF · fleet-wide</span><h2>Fleet summary PDF</h2><p>Generate a paginated, printable snapshot of fleet status and the latest telemetry from the backend.</p><button className="secondary-button" disabled={busy !== ""} onClick={() => exportBackend("pdf")}><Download size={15} />{busy === "pdf" ? "Preparing…" : "Download PDF"}</button></article>
      <article className="report-card"><div className="report-icon vehicle"><Printer size={22} /></div><span className="report-format">PDF · vehicle details</span><h2>Vehicle detail report</h2><p>Export per-vehicle readings currently loaded in this dashboard to a downloadable PDF.</p><button className="secondary-button" onClick={generateVehiclePdf}><Download size={15} />Generate vehicle PDF</button></article>
    </div>
    <div className="report-footnote">All reports use simulator-generated readings. {vehicles.length} vehicles included in the loaded fleet snapshot.</div>
  </>;
}
