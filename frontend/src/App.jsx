import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const Battery = lazy(() => import("./pages/Battery"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/Settings"));

export default function App() {
  return <Suspense fallback={<div className="route-loading">Loading fleet workspace…</div>}><Routes><Route element={<AppLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="tracking" element={<Tracking />} />
    <Route path="vehicles" element={<Vehicles />} />
    <Route path="battery" element={<Battery />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="analytics" element={<Analytics />} />
    <Route path="reports" element={<Reports />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes></Suspense>;
}
