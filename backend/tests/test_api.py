from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models import Alert, Telemetry, Vehicle
from app.services.alert_engine import evaluate_telemetry
from app.services.offline_monitor import detect_offline_vehicles
from app.services.vehicle_health import calculate_health_score


def test_vehicle_creation_and_duplicate_conflict(test_app):
    client, TestingSession = test_app
    assert client.post("/api/vehicles", json={"vehicle_number": "EV-TEST", "model": "Test EV"}).status_code == 409
    assert client.post("/api/vehicles", json={"vehicle_number": "EV-001", "model": "Duplicate"}).status_code == 409
    with TestingSession() as db:
        assert db.query(Vehicle).count() == 50
    assert client.get("/api/vehicles/999").status_code == 404


def test_telemetry_ingestion_generates_and_deduplicates_alerts(test_app):
    client, TestingSession = test_app
    vehicle_id = client.get("/api/vehicles/1").json()["id"]
    telemetry = {
        "vehicle_id": vehicle_id, "latitude": 12.97, "longitude": 77.59, "speed": 0,
        "battery_percentage": 10, "battery_temperature": 25, "voltage": 320,
    }
    assert client.post("/api/telemetry", json=telemetry).status_code == 201
    assert client.post("/api/telemetry", json=telemetry).status_code == 201
    assert len(client.get("/api/alerts").json()) == 1
    assert len(client.get(f"/api/telemetry/{vehicle_id}").json()) == 2
    alert_id = client.get("/api/alerts").json()[0]["id"]
    assert client.post(f"/api/alerts/{alert_id}/acknowledge").json()["status"] == "acknowledged"
    assert client.post(f"/api/alerts/{alert_id}/acknowledge").json()["status"] == "acknowledged"
    assert client.get("/api/alerts", params={"status": "active"}).json() == []
    with TestingSession() as db:
        assert db.query(Telemetry).filter_by(vehicle_id=vehicle_id).count() == 2
        assert db.query(Alert).filter_by(vehicle_id=vehicle_id).count() == 1


def test_invalid_telemetry_is_rejected_and_health_is_available(test_app):
    client, _ = test_app
    assert client.post("/api/telemetry", json={"vehicle_id": 1, "latitude": 100}).status_code == 422
    assert client.get("/api/health").json() == {"status": "ok", "database": "connected"}


def test_vehicle_delete_preserves_fixed_fleet(test_app):
    client, _ = test_app
    vehicle_id = client.get("/api/vehicles/1").json()["id"]
    assert client.delete(f"/api/vehicles/{vehicle_id}").status_code == 409
    assert client.get(f"/api/vehicles/{vehicle_id}").status_code == 200


def test_alert_engine_uses_active_condition_deduplication(test_app):
    _, TestingSession = test_app
    with TestingSession() as db:
        vehicle = Vehicle(vehicle_number="EV-ENGINE")
        db.add(vehicle)
        db.flush()
        sample = Telemetry(vehicle_id=vehicle.id, latitude=12.9, longitude=77.6, speed=0,
                           battery_percentage=5, battery_temperature=20, voltage=320)
        db.add(sample)
        assert len(evaluate_telemetry(db, vehicle, sample)) == 1
        db.flush()
        assert len(evaluate_telemetry(db, vehicle, sample)) == 0
        db.rollback()


def test_settings_thresholds_are_validated(test_app):
    client, _ = test_app
    response = client.put("/api/settings/thresholds", json={
        "low_battery_threshold": 15, "high_temperature_threshold": 48, "overspeed_threshold": 85,
    })
    assert response.status_code == 200
    assert response.json()["thresholds"]["low_battery_threshold"] == 15
    assert client.put("/api/settings/thresholds", json={
        "low_battery_threshold": 90, "high_temperature_threshold": 48, "overspeed_threshold": 85,
    }).status_code == 422
    settings.low_battery_threshold = 20
    settings.high_temperature_threshold = 50
    settings.overspeed_threshold = 80


def test_offline_monitor_marks_stale_vehicle_and_creates_alert(test_app):
    _, TestingSession = test_app
    with TestingSession() as db:
        vehicle = Vehicle(vehicle_number="EV-STALE", status="active")
        db.add(vehicle)
        db.flush()
        db.add(Telemetry(
            vehicle_id=vehicle.id, latitude=12.9, longitude=77.6, speed=12,
            battery_percentage=70, battery_temperature=30, voltage=380,
            timestamp=datetime.now(timezone.utc) - timedelta(seconds=90),
        ))
        db.flush()
        newly_offline, created_alerts = detect_offline_vehicles(db)
        assert [item.id for item in newly_offline] == [vehicle.id]
        assert len(created_alerts) == 1
        db.flush()
        newly_offline, created_alerts = detect_offline_vehicles(db)
        db.flush()
        assert newly_offline == []
        assert created_alerts == []
        assert vehicle.status == "offline"
        assert db.query(Alert).filter_by(vehicle_id=vehicle.id, alert_type="offline").count() == 1


def test_rule_based_vehicle_health_score():
    healthy = Telemetry(battery_percentage=75, battery_temperature=28, voltage=380)
    low_battery = Telemetry(battery_percentage=10, battery_temperature=28, voltage=380)
    assert calculate_health_score(healthy) == 100
    assert calculate_health_score(low_battery) == 70
    assert calculate_health_score(None) is None


def test_vehicle_health_thresholds_follow_settings():
    original = settings.low_battery_threshold
    settings.low_battery_threshold = 80
    try:
        sample = Telemetry(battery_percentage=75, battery_temperature=28, voltage=380)
        assert calculate_health_score(sample) == 70
    finally:
        settings.low_battery_threshold = original


def test_fleet_report_downloads(test_app):
    client, _ = test_app
    csv_response = client.get("/api/reports/fleet.csv")
    assert csv_response.status_code == 200
    assert "EV-001" in csv_response.text
    pdf_response = client.get("/api/reports/fleet.pdf")
    assert pdf_response.status_code == 200
    assert pdf_response.content.startswith(b"%PDF")


def test_seed_reconciles_to_exactly_50_vehicles(test_app):
    _, TestingSession = test_app
    from app.services.simulator import seed_fleet

    with TestingSession() as db:
        db.add(Vehicle(vehicle_number="EV-080", model="Extra vehicle", status="idle"))
        db.commit()
        seed_fleet(db)
        assert db.query(Vehicle).count() == 50
        assert db.query(Vehicle).filter_by(vehicle_number="EV-080").count() == 0


def test_summary_counts_are_backend_derived_and_consistent(test_app):
    client, _ = test_app
    summary = client.get("/api/analytics/summary").json()
    assert summary["total_vehicles"] == 50
    assert summary["active_vehicles"] + summary["idle_vehicles"] + summary["offline_vehicles"] == 50
    vehicle_id = client.get("/api/vehicles/1").json()["id"]
    client.post("/api/telemetry", json={
        "vehicle_id": vehicle_id, "latitude": 12.97, "longitude": 77.59, "speed": 0,
        "battery_percentage": 10, "battery_temperature": 25, "voltage": 320,
    })
    summary = client.get("/api/analytics/summary").json()
    assert summary["low_battery_vehicles"] == 1
    assert summary["average_battery"] > 0


def test_vehicle_search_status_filter_and_automatic_alert_rules(test_app):
    client, _ = test_app
    assert len(client.get("/api/vehicles", params={"status": "idle"}).json()) == 50
    assert [vehicle["vehicle_number"] for vehicle in client.get("/api/vehicles", params={"search": "EV-001"}).json()] == ["EV-001"]
    expected_types = ("low_battery", "high_temperature", "overspeed", "abnormal_telemetry")
    samples = (
        {"battery_percentage": 10, "battery_temperature": 25, "speed": 0, "voltage": 320},
        {"battery_percentage": 70, "battery_temperature": 60, "speed": 0, "voltage": 380},
        {"battery_percentage": 70, "battery_temperature": 25, "speed": 90, "voltage": 380},
        {"battery_percentage": 70, "battery_temperature": 25, "speed": 0, "voltage": 650},
    )
    for vehicle_id, readings in enumerate(samples, start=1):
        response = client.post("/api/telemetry", json={
            "vehicle_id": vehicle_id, "latitude": 12.97, "longitude": 77.59, **readings,
        })
        assert response.status_code == 201
    alert_types = {alert["alert_type"] for alert in client.get("/api/alerts").json()}
    assert alert_types == set(expected_types)


def test_csv_escapes_spreadsheet_formulas(test_app):
    client, TestingSession = test_app
    with TestingSession() as db:
        vehicle = db.query(Vehicle).filter_by(vehicle_number="EV-001").one()
        vehicle.model = "=2+2"
        db.commit()
    response = client.get("/api/reports/fleet.csv")
    assert "'=2+2" in response.text
