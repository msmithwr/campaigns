from __future__ import annotations

import html
import re
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "campaign-2-windows-sdp-2"
OUTPUT_DIR = ROOT / "output" / "pdf"
ASSET_DIR = Path("/Users/msmithwr/Downloads/pdfs/assets")
LINKEDIN_ASSET_DIR = ROOT / "output" / "linkedin-assets" / "campaign-2-windows-sdp"
ARABIC_FONT_PATHS = [
    Path("/Library/Fonts/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/GeezaPro.ttc"),
]
ARABIC_FONT = "ArabicBody"

CAMPAIGN_NAME = "Windows EC2 SDP Campaign 2"
CAMPAIGN_MONTH = "July 2026"
PREPARED_BY = "TANK.co.uk"
AUTHOR = "TANK.co.uk"

DOCUMENTS = [
    ("campaign-overview.md", "Windows EC2 SDP Campaign 2 - One-Month Campaign Overview", "windows-ec2-sdp-campaign-2-campaign-overview-july-2026.pdf"),
    ("campaign-calendar.md", "Campaign: Windows EC2 SDP Campaign 2", "windows-ec2-sdp-campaign-2-campaign-calendar-july-2026.pdf"),
    ("landing-page-brief.md", "Windows EC2 SDP Campaign 2 - Collateral Production Brief", "windows-ec2-sdp-campaign-2-collateral-brief-july-2026.pdf"),
    ("linkedin-calendar.md", "Windows EC2 SDP Campaign 2 - LinkedIn Content Calendar", "windows-ec2-sdp-campaign-2-linkedin-calendar-july-2026.pdf"),
    ("video-script.md", "Windows EC2 SDP Campaign 2 - Animated Video Script", "windows-ec2-sdp-campaign-2-video-script-july-2026.pdf"),
]

LINKEDIN_ORIGINAL_CREATIVES = [
    ("07-cloudwrxs-windows-launch-2f2b2a143e16f8ba.jpg", "Launch - Windows EC2 SDP Campaign 2"),
    ("06-cloudwrxs-sdp-savings-58f842c08f553036.jpg", "Operations - AWS SDP and Automation"),
    ("05-cloudwrxs-windows-licensing-4d678783a57fbc68.jpg", "CFO / Procurement - Windows Licensing Optimisation"),
    ("02-cloudwrxs-windows-sdp-85d38474e08a807a.jpg", "Final CTA - Clear TCO Roadmap"),
]

DATE_REPLACEMENTS = [
    ("June 2026", "July 2026"),
    ("JUNE 2026", "JULY 2026"),
    ("June campaign", "July campaign"),
    ("June SDP", "July SDP"),
    ("June is", "July is"),
    ("runs in June 2026", "runs in July 2026"),
    ("Following our May Windows modernisation campaign", "Following our earlier Windows modernisation campaign"),
    ("Week 1 (1-7 June)", "Week 1 (1-7 July)"),
    ("Week 1 (1–7 June)", "Week 1 (1-7 July)"),
    ("Week 2 (8-14 June)", "Week 2 (8-14 July)"),
    ("Week 2 (8–14 June)", "Week 2 (8-14 July)"),
    ("Week 3 (15-21 June)", "Week 3 (15-21 July)"),
    ("Week 3 (15–21 June)", "Week 3 (15-21 July)"),
    ("Week 4 (22-30 June)", "Week 4 (22-31 July)"),
    ("Week 4 (22–30 June)", "Week 4 (22-31 July)"),
    ("June 2026, 4 Posts", "July 2026, 4 Posts"),
    ("during June 2026", "during July 2026"),
]


def register_fonts() -> None:
    if ARABIC_FONT in pdfmetrics.getRegisteredFontNames():
        return
    for path in ARABIC_FONT_PATHS:
        if path.exists():
            pdfmetrics.registerFont(TTFont(ARABIC_FONT, str(path)))
            return


def contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06ff]", text))


def shape_arabic_run(text: str) -> str:
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)


def shape_and_escape(text: str) -> str:
    parts = re.split(r"([\u0600-\u06ff][\u0600-\u06ff\s،؛؟ً-ٟ٠-٩\.\-]*)", text)
    output = []
    for part in parts:
        if not part:
            continue
        if contains_arabic(part):
            whitespace = re.match(r"^(\s*)(.*?)(\s*)$", part, flags=re.DOTALL)
            leading, core, trailing = whitespace.groups() if whitespace else ("", part, "")
            output.append(html.escape(leading))
            output.append(f'<font name="{ARABIC_FONT}">{html.escape(shape_arabic_run(core))}</font>')
            output.append(html.escape(trailing))
        else:
            output.append(html.escape(part))
    return "".join(output)


def clean_inline(text: str) -> str:
    chunks = re.split(r"(\*\*.+?\*\*|\*.+?\*)", text)
    output = []
    for chunk in chunks:
        if not chunk:
            continue
        if chunk.startswith("**") and chunk.endswith("**"):
            output.append(f"<b>{shape_and_escape(chunk[2:-2])}</b>")
        elif chunk.startswith("*") and chunk.endswith("*"):
            output.append(f"<i>{shape_and_escape(chunk[1:-1])}</i>")
        else:
            output.append(shape_and_escape(chunk))
    return "".join(output)


def normalize_campaign_dates(text: str) -> str:
    for old, new in DATE_REPLACEMENTS:
        text = text.replace(old, new)
    text = re.sub(r"\|\s*June 2026\s*\|", "| July 2026 |", text)
    text = text.replace("—", "-").replace("–", "-")
    return text


def plain_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if re.match(r"^#{1,6}\s+", stripped):
            return stripped.lstrip("#").strip()
        if stripped and not stripped.startswith("---"):
            return stripped.strip("* ")
    return fallback


def table_rows(lines: list[str]) -> list[list[str]]:
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", cell or "") for cell in cells):
            continue
        rows.append(cells)
    return rows


def build_styles():
    sample = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=sample["Title"],
            fontName="Helvetica",
            fontSize=34,
            leading=39,
            textColor=colors.HexColor("#101010"),
            spaceAfter=18,
            alignment=TA_LEFT,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=12,
            leading=17,
            textColor=colors.HexColor("#101010"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=sample["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=29,
            textColor=colors.HexColor("#111111"),
            spaceBefore=6,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#111111"),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#111111"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=13,
            textColor=colors.HexColor("#222222"),
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.5,
            textColor=colors.HexColor("#222222"),
        ),
        "small": ParagraphStyle(
            "small",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11,
            textColor=colors.HexColor("#5d6761"),
        ),
        "table": ParagraphStyle(
            "table",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10,
            textColor=colors.HexColor("#222222"),
        ),
        "table_head": ParagraphStyle(
            "table_head",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.3,
            leading=10,
            textColor=colors.white,
        ),
    }


register_fonts()
STYLES = build_styles()


def cover_table(source_name: str):
    data = [
        [Paragraph("Campaign", STYLES["small"]), Paragraph(CAMPAIGN_NAME, STYLES["small"])],
        [Paragraph("Campaign month", STYLES["small"]), Paragraph(CAMPAIGN_MONTH, STYLES["small"])],
        [Paragraph("Source markdown", STYLES["small"]), Paragraph(source_name, STYLES["small"])],
        [Paragraph("Prepared by", STYLES["small"]), Paragraph(PREPARED_BY, STYLES["small"])],
    ]
    table = Table(data, colWidths=[45 * mm, 115 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4efe3")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#101010")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#d2d9d3")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d3cec2")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def divider():
    table = Table([[""]], colWidths=[160 * mm], rowHeights=[1])
    table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.55, colors.HexColor("#d3cec2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def parse_markdown(markdown: str):
    flow = []
    lines = normalize_campaign_dates(markdown).splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()
        if not stripped or stripped == "---":
            i += 1
            continue
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = table_rows(table_lines)
            if rows:
                max_cols = max(len(row) for row in rows)
                rows = [row + [""] * (max_cols - len(row)) for row in rows]
                usable_width = 158 * mm
                data = []
                for row_index, row in enumerate(rows):
                    style = STYLES["table_head"] if row_index == 0 else STYLES["table"]
                    data.append([Paragraph(clean_inline(cell), style) for cell in row])
                table = Table(data, colWidths=[usable_width / max_cols] * max_cols, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#101010")),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f6f2e9")),
                            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d3cec2")),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 5),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                            ("TOPPADDING", (0, 0), (-1, -1), 5),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ]
                    )
                )
                flow.extend([table, Spacer(1, 7)])
            continue
        if re.match(r"^#{1,6}\s+", stripped):
            level = len(stripped) - len(stripped.lstrip("#"))
            text = stripped.lstrip("#").strip()
            style = "h1" if level == 1 else "h2" if level == 2 else "h3"
            flow.append(Paragraph(clean_inline(text), STYLES[style]))
            i += 1
            continue
        if stripped.startswith(("- ", "* ")):
            items = []
            while i < len(lines) and lines[i].strip().startswith(("- ", "* ")):
                item_text = lines[i].strip()[2:].strip()
                items.append(ListItem(Paragraph(clean_inline(item_text), STYLES["bullet"]), leftIndent=12))
                i += 1
            flow.append(ListFlowable(items, bulletType="bullet", start="circle", leftIndent=14, bulletFontSize=5))
            flow.append(Spacer(1, 4))
            continue
        if re.match(r"^\d+\.\s+", stripped):
            items = []
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i].strip()):
                item_text = re.sub(r"^\d+\.\s+", "", lines[i].strip())
                items.append(ListItem(Paragraph(clean_inline(item_text), STYLES["bullet"]), leftIndent=16))
                i += 1
            flow.append(ListFlowable(items, bulletType="1", leftIndent=16))
            flow.append(Spacer(1, 4))
            continue
        paragraph_lines = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or re.match(r"^#{1,6}\s+", nxt) or nxt.startswith("|") or nxt.startswith(("- ", "* ")) or re.match(r"^\d+\.\s+", nxt):
                break
            paragraph_lines.append(nxt)
            i += 1
        flow.append(Paragraph(clean_inline(" ".join(paragraph_lines)), STYLES["body"]))
    return flow


def add_tank_canvas(canvas, doc, title: str):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#f4efe3"))
    canvas.rect(0, 0, width, height, stroke=0, fill=1)

    def angled_block(x, y, w, h, color, skew=8 * mm):
        path = canvas.beginPath()
        path.moveTo(x + skew, y)
        path.lineTo(x + w, y + 2 * mm)
        path.lineTo(x + w - skew, y + h)
        path.lineTo(x, y + h - 2 * mm)
        path.close()
        canvas.setFillColor(color)
        canvas.drawPath(path, stroke=0, fill=1)

    canvas.setFillColor(colors.HexColor("#28c9bd"))
    angled_block(width - 54 * mm, height * 0.15, 76 * mm, 19 * mm, colors.HexColor("#28c9bd"))
    angled_block(width - 31 * mm, height * 0.67, 36 * mm, 13 * mm, colors.HexColor("#bde941"))
    angled_block(width - 24 * mm, height * 0.05, 37 * mm, 13 * mm, colors.HexColor("#bde941"))

    canvas.setFillColor(colors.HexColor("#101010"))
    canvas.setFont("Helvetica-Bold", 62)
    canvas.rotate(90)
    canvas.drawString(height * 0.50, -width + 18 * mm, "TANK")
    canvas.rotate(-90)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#5d6761"))
    page_text = f"{CAMPAIGN_NAME} | {CAMPAIGN_MONTH} | {doc.page}"
    canvas.drawRightString(width - 18 * mm, 13 * mm, page_text)
    canvas.restoreState()


def make_pdf(source_name: str, title: str, output_name: str):
    source = SOURCE_DIR / source_name
    text = source.read_text(encoding="utf-8")
    title = title or plain_title(text, title)
    output = OUTPUT_DIR / output_name
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=35 * mm,
        leftMargin=24 * mm,
        topMargin=24 * mm,
        bottomMargin=24 * mm,
        title=title,
        author=AUTHOR,
    )
    story = []
    logo = ASSET_DIR / "tank-logo-sips.png"
    hero = ASSET_DIR / "tank-hero-pdf.jpg"
    if logo.exists():
        logo_image = Image(str(logo), width=39 * mm, height=10.3 * mm)
        logo_image.hAlign = "LEFT"
        story.append(logo_image)
        story.append(Spacer(1, 10))
        story.append(divider())
    story.append(Spacer(1, 18))
    if hero.exists():
        story.append(Image(str(hero), width=150 * mm, height=83 * mm))
        story.append(Spacer(1, 14))
    story.append(Paragraph(title, STYLES["cover_title"]))
    story.append(Paragraph("Partner-ready campaign detail pack prepared in the TANK visual style for Cloudwrxs.", STYLES["cover_subtitle"]))
    story.append(cover_table(source_name))
    story.append(PageBreak())
    story.extend(parse_markdown(text))
    doc.build(story, onFirstPage=lambda c, d: add_tank_canvas(c, d, title), onLaterPages=lambda c, d: add_tank_canvas(c, d, title))
    return output


def make_linkedin_asset_pdf():
    title = "Windows EC2 SDP Campaign 2 - LinkedIn Creative Assets"
    output = OUTPUT_DIR / "windows-ec2-sdp-campaign-2-linkedin-creative-assets-originals.pdf"
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=35 * mm,
        leftMargin=24 * mm,
        topMargin=24 * mm,
        bottomMargin=24 * mm,
        title=title,
        author=AUTHOR,
    )
    story = []
    logo = ASSET_DIR / "tank-logo-sips.png"
    hero = ASSET_DIR / "tank-hero-pdf.jpg"
    if logo.exists():
        logo_image = Image(str(logo), width=39 * mm, height=10.3 * mm)
        logo_image.hAlign = "LEFT"
        story.append(logo_image)
        story.append(Spacer(1, 10))
        story.append(divider())
    story.append(Spacer(1, 18))
    if hero.exists():
        story.append(Image(str(hero), width=150 * mm, height=83 * mm))
        story.append(Spacer(1, 14))
    story.append(Paragraph(title, STYLES["cover_title"]))
    story.append(
        Paragraph(
            "Original LinkedIn campaign creatives copied from published Cloudwrxs posts. These assets support the July 2026 campaign sequence.",
            STYLES["cover_subtitle"],
        )
    )
    story.append(cover_table("LinkedIn published post assets"))
    story.append(PageBreak())
    story.append(Paragraph("Original LinkedIn Creative Assets", STYLES["h1"]))
    story.append(
        Paragraph(
            "The four creative assets below correspond to the Windows EC2 SDP Campaign 2 LinkedIn sequence: launch, operations, licensing, and final TCO roadmap CTA.",
            STYLES["body"],
        )
    )
    rows = []
    row = []
    for filename, caption in LINKEDIN_ORIGINAL_CREATIVES:
        image_path = LINKEDIN_ASSET_DIR / filename
        if not image_path.exists():
            continue
        cell = [
            Image(str(image_path), width=68 * mm, height=68 * mm),
            Paragraph(caption, STYLES["h3"]),
        ]
        row.append(cell)
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        row.append("")
        rows.append(row)
    if rows:
        table = Table(rows, colWidths=[78 * mm, 78 * mm], rowHeights=[86 * mm] * len(rows))
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f6f2e9")),
                    ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#d3cec2")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d3cec2")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
    doc.build(story, onFirstPage=lambda c, d: add_tank_canvas(c, d, title), onLaterPages=lambda c, d: add_tank_canvas(c, d, title))
    return output


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = []
    for source_name, title, output_name in DOCUMENTS:
        outputs.append(make_pdf(source_name, title, output_name))
    outputs.append(make_linkedin_asset_pdf())
    print("\n".join(str(path) for path in outputs))


if __name__ == "__main__":
    main()
