export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${(status || "offline").toLowerCase()}`}>{status || "unknown"}</span>;
}
