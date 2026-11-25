import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Alert, Telemetry, Vehicle

router = APIRouter(prefix="/api/reports", tags=["reports"])


def report_rows(db: Session):
    vehicles = db.scalars(select(Vehicle).order_by(Vehicle.vehicle_number))
    rows = []
    for vehicle in vehicles:
        latest = db.scalar(select(Telemetry).where(Telemetry.vehicle_id == vehicle.id).order_by(Telemetry.timestamp.desc()).limit(1))
        alert_count = db.query(Alert).filter(Alert.vehicle_id == vehicle.id, Alert.status == "active").count()
        rows.append((vehicle, latest, alert_count))
    return rows


def _spreadsheet_safe(value):
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


@router.get("/fleet.csv")
def fleet_csv(db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Vehicle", "Model", "Status", "Battery %", "Speed km/h", "Temperature C", "Voltage V", "Active alerts"])
    for vehicle, sample, alert_count in report_rows(db):
        writer.writerow([_spreadsheet_safe(vehicle.vehicle_number), _spreadsheet_safe(vehicle.model), _spreadsheet_safe(vehicle.status),
                         sample.battery_percentage if sample else "", sample.speed if sample else "",
                         sample.battery_temperature if sample else "", sample.voltage if sample else "", alert_count])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=fleet-report.csv"})


@router.get("/fleet.pdf")
def fleet_pdf(db: Session = Depends(get_db)):
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=letter)
    pdf.setTitle("EV Fleet Summary")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(48, 750, "EV Fleet Summary")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(48, 732, f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | Simulator data")
    y = 705
    for vehicle, sample, alert_count in report_rows(db):
        if y < 55:
            pdf.showPage()
            y = 750
        summary = f"{vehicle.vehicle_number}  |  {vehicle.status.upper()}  |  Battery {sample.battery_percentage:.0f}%  |  {sample.speed:.0f} km/h  |  {alert_count} active alerts" if sample else f"{vehicle.vehicle_number}  |  No telemetry yet"
        pdf.drawString(48, y, summary)
        y -= 18
    pdf.save()
    return Response(output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=fleet-report.pdf"})
