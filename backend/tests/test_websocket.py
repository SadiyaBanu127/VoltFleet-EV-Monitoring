import asyncio

from app.websocket.manager import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.messages = []
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def send_json(self, message):
        self.messages.append(message)


def test_websocket_manager_broadcasts_and_disconnects():
    async def exercise():
        manager = ConnectionManager()
        socket = FakeWebSocket()
        await manager.connect(socket)
        await manager.broadcast({"type": "telemetry", "data": [{"vehicle_id": 1}]})
        assert socket.accepted
        assert socket.messages == [{"type": "telemetry", "data": [{"vehicle_id": 1}]}]
        await manager.disconnect(socket)
        assert not manager.active_connections

    asyncio.run(exercise())


def test_websocket_receives_live_telemetry_and_alerts(test_app):
    client, _ = test_app
    vehicle_id = client.get("/api/vehicles/1").json()["id"]
    telemetry = {
        "vehicle_id": vehicle_id, "latitude": 12.97, "longitude": 77.59, "speed": 0,
        "battery_percentage": 10, "battery_temperature": 25, "voltage": 320,
    }
    with client.websocket_connect("/ws/telemetry") as websocket:
        assert client.post("/api/telemetry", json=telemetry).status_code == 201
        telemetry_event = websocket.receive_json()
        alert_event = websocket.receive_json()
    assert telemetry_event["type"] == "telemetry"
    assert telemetry_event["data"][0]["vehicle_id"] == vehicle_id
    assert alert_event["type"] == "alerts"
    assert alert_event["data"][0]["alert_type"] == "low_battery"
