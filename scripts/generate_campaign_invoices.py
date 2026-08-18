from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "invoices"
OUT.mkdir(parents=True, exist_ok=True)


@dataclass
class LineItem:
    description: str
    quantity: float
    unit_price: float
    vat: str = "20%"

    @property
    def amount(self) -> float:
        return self.quantity * self.unit_price


@dataclass
class Invoice:
    number: str
    reference: str
    filename: str
    items: list[LineItem]
    invoice_date: str = "17 Aug 2026"
    due_date: str = "16 Sep 2026"

    @property
    def subtotal(self) -> float:
        return sum(item.amount for item in self.items)

    @property
    def vat_total(self) -> float:
        return self.subtotal * 0.20

    @property
    def total(self) -> float:
        return self.subtotal + self.vat_total


def money(value: float) -> str:
    return f"{value:,.2f}"


styles = getSampleStyleSheet()
P = ParagraphStyle(
    "InvoiceParagraph",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=10,
    alignment=TA_LEFT,
)
PR = ParagraphStyle(
    "InvoiceParagraphRight",
    parent=P,
    alignment=TA_RIGHT,
)
SMALL = ParagraphStyle(
    "Small",
    parent=P,
    fontSize=7,
    leading=8,
)


TO_ADDRESS = "To: Cloudwrxs Consulting Limited<br/>International House<br/>36-38 Cornhill<br/>London<br/>Greater London<br/>EC3V 3NG<br/>UNITED KINGDOM"
FROM_ADDRESS = "Tank PR Limited<br/>5 Kays Walk, The Lace<br/>Market<br/>Nottingham<br/>NG1 1PY<br/>UNITED KINGDOM<br/>VAT Number: 983289566"
PAYMENT_TO = "To: &nbsp; Tank PR Limited<br/>5 Kays Walk, The Lace Market<br/>NOTTINGHAM NG1 1PY<br/>UNITED KINGDOM"
REGISTERED_OFFICE = "Registered Office: 5 Kays Walk, The Lace Market, Nottingham, NG1 1PY, United Kingdom"


def build_invoice(inv: Invoice) -> Path:
    path = OUT / inv.filename
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=15 * mm,
        bottomMargin=13 * mm,
    )
    story = []

    story.append(Paragraph("INVOICE", ParagraphStyle("Title", parent=P, fontSize=23, leading=27)))
    story.append(Spacer(1, 10 * mm))

    header = Table(
        [
            [
                Paragraph(TO_ADDRESS, P),
                Paragraph(f"Invoice Date<br/>{inv.invoice_date}<br/><br/>Invoice Number<br/>{inv.number}<br/><br/>Reference<br/>{inv.reference}", P),
                Paragraph(FROM_ADDRESS, P),
            ]
        ],
        colWidths=[64 * mm, 60 * mm, 54 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header)
    story.append(Spacer(1, 11 * mm))

    rows = [[Paragraph("Description", P), "Quantity", "Unit Price", "VAT", "Amount GBP"]]
    for item in inv.items:
        rows.append(
            [
                Paragraph(item.description, P),
                f"{item.quantity:.2f}",
                money(item.unit_price),
                item.vat,
                money(item.amount),
            ]
        )

    table = Table(rows, colWidths=[86 * mm, 24 * mm, 28 * mm, 19 * mm, 29 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (1, 0), (-1, 0), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 3 * mm))

    totals = Table(
        [
            ["", "Subtotal", money(inv.subtotal)],
            ["", "Total VAT 20%", money(inv.vat_total)],
            ["", "Invoice Total GBP", money(inv.total)],
            ["", "Total Net Payments GBP", "0.00"],
            ["", "Amount Due GBP", money(inv.total)],
        ],
        colWidths=[92 * mm, 56 * mm, 38 * mm],
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("LINEABOVE", (1, 2), (-1, 2), 0.5, colors.black),
                ("LINEABOVE", (1, 4), (-1, 4), 0.5, colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    story.append(totals)
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph(f"Due Date: &nbsp; {inv.due_date}", P))
    story.append(Spacer(1, 10 * mm))

    story.append(Table([[""]], colWidths=[186 * mm], style=[("LINEABOVE", (0, 0), (-1, -1), 0.5, colors.black)]))
    story.append(Paragraph("PAYMENT ADVICE", ParagraphStyle("Advice", parent=P, fontSize=22, leading=26)))
    story.append(Spacer(1, 5 * mm))

    advice = Table(
        [
            [
                Paragraph(PAYMENT_TO, P),
                Table(
                    [
                        ["Customer", "Cloudwrxs Consulting Ltd"],
                        ["Invoice Number", inv.number],
                        ["Amount Due", money(inv.total)],
                        ["Due Date", inv.due_date],
                        ["Amount Enclosed", ""],
                        ["", "Enter the amount you are paying above"],
                    ],
                    colWidths=[32 * mm, 56 * mm],
                    style=[
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 0), (-1, -2), 8.5),
                        ("FONTSIZE", (1, -1), (1, -1), 7),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("LINEBELOW", (1, 0), (1, 4), 0.5, colors.black),
                        ("LINEBELOW", (0, 2), (-1, 2), 0.5, colors.black),
                        ("LINEBELOW", (0, 3), (-1, 3), 0.5, colors.black),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ],
                ),
            ]
        ],
        colWidths=[84 * mm, 92 * mm],
    )
    advice.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(advice)
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(REGISTERED_OFFICE, SMALL))

    def canvas_factory(*args, **kwargs):
        kwargs["pdfVersion"] = (1, 7)
        return canvas.Canvas(*args, **kwargs)

    doc.build(story, canvasmaker=canvas_factory)
    return path


invoices = [
    Invoice(
        number="Invoice 5732",
        reference="CWXS-Windows-EC2-SDP<br/>Campaign-2",
        filename="Invoice 5732 Jul.pdf",
        invoice_date="01 Jul 2026",
        due_date="31 Jul 2026",
        items=[
            LineItem(
                "Windows EC2 SDP Campaign 2 - Campaign strategy, persona development, email sequences (3-email cadence x4 personas), WhatsApp touchpoints, call scripts",
                1,
                3200,
            ),
            LineItem("Campaign landing pages - Windows SDP Modernisation (English + Arabic versions)", 2, 1200),
            LineItem(
                "Campaign collateral - One-pager PDF (eng + arabic), email banner graphics, social media assets and LinkedIn creative assets",
                1,
                2000,
            ),
            LineItem(
                "Campaign video package - bilingual explainer script, text-free source direction, English + Arabic final videos",
                1,
                2000,
            ),
            LineItem("Campaign calendar & reporting framework - 1-month execution plan with KPI tracking", 1, 1200),
        ],
    ),
    Invoice(
        number="Invoice 5756",
        reference="CWXS-Well-Architected<br/>Campaign-1",
        filename="Invoice 5756 Aug.pdf",
        invoice_date="03 Aug 2026",
        due_date="02 Sep 2026",
        items=[
            LineItem(
                "AWS Well-Architected Partner Program Campaign 1 - Campaign strategy, persona development, email sequences (4-email cadence x4 personas), WhatsApp touchpoints, call scripts",
                3,
                3200,
            ),
            LineItem("Campaign landing pages - WAFR landing page redesign (English + Arabic versions)", 2, 1200),
            LineItem(
                "Campaign collateral - WAFR one-pager (eng + arabic), security/compliance checklist, 6-pillar infographic, social media assets, CTO deck outline",
                1,
                2000,
            ),
            LineItem(
                "Whitepaper package - Is Your Cloud Really Well-Architected? whitepaper production, promotional copy, follow-up, and delivery assets",
                1,
                2000,
            ),
            LineItem("Campaign calendar & reporting framework - 3-month execution plan with KPI tracking", 3, 1200),
        ],
    ),
    Invoice(
        number="Invoice 5697",
        reference="CWXS-SAP-Competency<br/>Campaign-2",
        filename="Invoice 5697 Jun.pdf",
        invoice_date="01 Jun 2026",
        due_date="01 Jul 2026",
        items=[
            LineItem(
                "SAP Competency Campaign 2 - Campaign strategy, persona development, email sequences (4-email cadence x5 personas), WhatsApp touchpoints, call scripts",
                3,
                3200,
            ),
            LineItem("Campaign landing page updates - existing SAP page refresh and whitepaper download integration", 1, 1200),
            LineItem(
                "Campaign collateral - SAP battlecard, one-pager collateral, SAP on AWS infographic, email banner graphics and social media assets",
                1,
                2000,
            ),
            LineItem(
                "Case study package - Manufacturing and Financial Services/Government proof assets for SAP migration conversion",
                1,
                2000,
            ),
            LineItem(
                "Whitepaper package - SAP Modernisation Masterclass whitepaper production, promotion, follow-up, and gated-content assets",
                1,
                2000,
            ),
            LineItem("Campaign calendar & reporting framework - 3-month execution plan with KPI tracking", 3, 1200),
        ],
    ),
]


def main() -> None:
    for invoice in invoices:
        path = build_invoice(invoice)
        print(f"{path}: subtotal {money(invoice.subtotal)} vat {money(invoice.vat_total)} total {money(invoice.total)}")


if __name__ == "__main__":
    main()
