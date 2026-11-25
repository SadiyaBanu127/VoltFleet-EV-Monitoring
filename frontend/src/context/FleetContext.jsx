import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getErrorMessage } from "../services/api";

const FleetContext = createContext(null);

function updateSummaryFromVehicles(summary, vehicles, lowBatteryThreshold) {
  if (!summary) return summary;
  const telemetry = vehicles.map((vehicle) => vehicle.latest_telemetry).filter(Boolean);
  const count = (status) => vehicles.filter((vehicle) => vehicle.status === status).length;
  const distribution = ["active", "idle", "offline"].map((status) => ({
    name: status[0].toUpperCase() + status.slice(1),
    value: count(status),
  }));
  return {
    ...summary,
    total_vehicles: vehicles.length,
    active_vehicles: count("active"),
    idle_vehicles: count("idle"),
    offline_vehicles: count("offline"),
    low_battery_vehicles: telemetry.filter((sample) => sample.battery_percentage < lowBatteryThreshold).length,
    average_battery: telemetry.length ? Number((telemetry.reduce((total, sample) => total + sample.battery_percentage, 0) / telemetry.length).toFixed(1)) : 0,
    average_speed: telemetry.length ? Number((telemetry.reduce((total, sample) => total + sample.speed, 0) / telemetry.length).toFixed(1)) : 0,
    status_distribution: distribution,
  };
}

export function FleetProvider({ children }) {
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lowBatteryThreshold, setLowBatteryThreshold] = useState(20);
  const vehiclesRef = useRef([]);
  const lowBatteryThresholdRef = useRef(lowBatteryThreshold);
  useEffect(() => { lowBatteryThresholdRef.current = lowBatteryThreshold; }, [lowBatteryThreshold]);

  const refresh = useCallback(async () => {
    try {
      const [vehicleResponse, summaryResponse, alertResponse, settingsResponse] = await Promise.all([
        api.get("/api/vehicles"),
        api.get("/api/analytics/summary"),
        api.get("/api/alerts", { params: { limit: 8 } }),
        api.get("/api/settings"),
      ]);
      vehiclesRef.current = vehicleResponse.data;
      setVehicles(vehicleResponse.data);
      setSummary(summaryResponse.data);
      setAlerts(alertResponse.data);
      setLowBatteryThreshold(settingsResponse.data.thresholds.low_battery_threshold);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setConnection("offline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, 30000);
    let socket;
    let retryTimer;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const socketUrl = apiUrl.replace(/^http/, "ws") + "/ws/telemetry";
      socket = new WebSocket(socketUrl);
      socket.onopen = () => setConnection("live");
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          setError("The live telemetry service sent an invalid message.");
          socket.close();
          return;
        }
        const updates = Array.isArray(message.data) ? message.data : [message.data];
        if (message.type === "telemetry") {
          const next = vehiclesRef.current.map((vehicle) => {
            const sample = updates.find((item) => item.vehicle_id === vehicle.id);
            return sample ? { ...vehicle, status: sample.status, latest_telemetry: sample, health_score: sample.health_score } : vehicle;
          });
          vehiclesRef.current = next;
          setVehicles(next);
          setSummary((previous) => updateSummaryFromVehicles(previous, next, lowBatteryThresholdRef.current));
        } else if (message.type === "vehicle_status") {
          const next = vehiclesRef.current.map((vehicle) => {
            const status = updates.find((item) => item.vehicle_id === vehicle.id)?.status;
            return status ? { ...vehicle, status } : vehicle;
          });
          vehiclesRef.current = next;
          setVehicles(next);
          setSummary((previous) => updateSummaryFromVehicles(previous, next, lowBatteryThresholdRef.current));
        } else if (message.type === "alerts") {
          setAlerts((current) => {
            const next = [...current];
            for (const alert of updates) {
              const index = next.findIndex((item) => item.id === alert.id);
              if (index >= 0) next[index] = alert;
              else if (alert.status === "active") next.unshift(alert);
            }
            return next.slice(0, 8);
          });
          setSummary((previous) => {
            if (!previous) return previous;
            const acknowledged = updates.filter((item) => item.status === "acknowledged").length;
            const created = updates.filter((item) => item.status === "active").length;
            return { ...previous, active_alerts: Math.max(0, previous.active_alerts + created - acknowledged) };
          });
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        setConnection("reconnecting");
        if (!stopped) retryTimer = window.setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ vehicles, summary, alerts, connection, error, loading, lowBatteryThreshold, refresh, setAlerts }),
    [vehicles, summary, alerts, connection, error, loading, lowBatteryThreshold, refresh],
  );
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export const useFleet = () => useContext(FleetContext);
