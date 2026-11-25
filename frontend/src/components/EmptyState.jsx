import { Radio } from "lucide-react";

export default function EmptyState({ title = "No data available", detail = "Telemetry will appear here as the simulator runs." }) {
  return <div className="empty-state"><Radio size={24} /><strong>{title}</strong><span>{detail}</span></div>;
}
