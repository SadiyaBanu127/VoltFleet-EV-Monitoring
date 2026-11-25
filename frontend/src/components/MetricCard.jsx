export default function MetricCard({ label, value, detail, icon: Icon, tone = "blue" }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}><Icon size={19} /></div>
      <div className="metric-copy"><span>{label}</span><strong>{value ?? "—"}</strong><small>{detail}</small></div>
    </article>
  );
}
