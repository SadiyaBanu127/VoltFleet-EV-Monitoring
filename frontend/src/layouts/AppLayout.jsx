import { Activity, AlertTriangle, BatteryCharging, BarChart3, CarFront, ChevronLeft, ChevronRight, LayoutDashboard, Map, Menu, Moon, Settings, Sun, Truck, FileText } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useFleet } from "../context/FleetContext";
import { useTheme } from "../context/ThemeContext";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/tracking", label: "Live tracking", icon: Map },
  { to: "/vehicles", label: "Vehicles", icon: CarFront },
  { to: "/battery", label: "Battery health", icon: BatteryCharging },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];
const titles = Object.fromEntries(navigation.map((item) => [item.to, item.label]));

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { connection, summary, error } = useFleet();
  const { theme, setTheme } = useTheme();
  const { pathname } = useLocation();
  const title = titles[pathname] || "Fleet operations";

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Truck size={20} /></div><div className="brand-name"><strong>volt<span>fleet</span></strong><small>OPERATIONS PLATFORM</small></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={18} /><span>{label}</span>{label === "Alerts" && summary?.active_alerts > 0 && <em>{summary.active_alerts}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className={`connection-dot ${connection === "live" ? "online" : ""}`} /><span>{connection === "live" ? "Simulator connected" : connection === "offline" ? "Backend unavailable" : "Connecting..."}</span></div>
          <div className="account-row"><div className="avatar">FO</div><div><strong>Fleet Operator</strong><small>Operations team</small></div><Activity className="account-icon" size={16} /></div>
        </div>
        <button className="collapse-button" aria-label="Collapse sidebar" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumbs">Fleet management <span>/</span> <strong>{title}</strong></div><div className="topbar-actions"><span className="topbar-live"><span className={`connection-dot ${connection === "live" ? "online" : ""}`} />{connection === "live" ? "Live updates" : "Reconnecting"}</span><button className="icon-button theme-toggle" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><div className="topbar-avatar">FO</div></div></header>
        <div className="content">{error && <div className="error-banner"><AlertTriangle size={16} />{error}</div>}<Outlet /></div>
        <footer className="app-footer"><span>VoltFleet Operations</span><span>Simulator environment · Not connected to physical vehicles</span></footer>
      </main>
    </div>
  );
}
