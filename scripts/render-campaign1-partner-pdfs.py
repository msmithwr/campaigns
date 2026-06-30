from __future__ import annotations

import html
import re
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
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
CAMPAIGN_DIR = ROOT / "campaign-1-windows-sdp-1"
OUTPUT_DIR = CAMPAIGN_DIR / "pdfs"
ASSET_DIR = OUTPUT_DIR / "assets"
LOGO = ASSET_DIR / "tank-logo-sips.png"
HERO = ASSET_DIR / "tank-hero-pdf.jpg"

PAGE_W, PAGE_H = A4
OFF_WHITE = colors.HexColor("#F6F2E8")
INK = colors.HexColor("#111111")
MUTED = colors.HexColor("#5B625E")
TEAL = colors.HexColor("#22D6C8")
LIME = colors.HexColor("#BDE74F")
LINE = colors.HexColor("#D8D2C4")


def register_fonts() -> tuple[str, str]:
    regular = "/Library/Fonts/Arial Unicode.ttf"
    fallback = "/System/Library/Fonts/Supplemental/Arial.ttf"
    pdfmetrics.registerFont(TTFont("CampaignSans", regular))
    pdfmetrics.registerFont(TTFont("CampaignSansBold", fallback))
    return "CampaignSans", "CampaignSansBold"


FONT, BOLD = register_fonts()


def pdf_text_for_april(markdown: str) -> str:
    replacements = {
        "May 2026": "April 2026",
        "MAY 2026": "APRIL 2026",
        "May": "April",
        "MAY": "APRIL",
    }
    for old, new in replacements.items():
        markdown = markdown.replace(old, new)
    return markdown


def inline_markup(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font backColor='#ECE6D8'>\1</font>", text)
    return text


def clean_line(line: str) -> str:
    return (
        line.rstrip()
        .replace("✓", "•")
        .replace("📞", "Phone:")
        .replace("📧", "Email:")
        .replace("🌐", "Web:")
        .replace("📍", "Office:")
    )


def title_from_md(path: Path, text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem.replace("-", " ").title()


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TankTitle",
            fontName=BOLD,
            fontSize=27,
            leading=31,
            textColor=INK,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TankH1",
            fontName=BOLD,
            fontSize=20,
            leading=24,
            textColor=INK,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TankH2",
            fontName=BOLD,
            fontSize=14,
            leading=18,
            textColor=INK,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TankBody",
            fontName=FONT,
            fontSize=9.6,
            leading=14,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TankSmall",
            fontName=FONT,
            fontSize=8.2,
            leading=10.5,
            textColor=MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TankBullet",
            parent=styles["TankBody"],
            leftIndent=3,
        )
    )
    return styles


STYLES = make_styles()


def table_from_lines(lines: list[str]) -> Table:
    rows: list[list[Paragraph]] = []
    for line in lines:
        parts = [p.strip() for p in line.strip().strip("|").split("|")]
        if all(set(p) <= {"-", ":", " "} for p in parts):
            continue
        rows.append([Paragraph(inline_markup(p), STYLES["TankSmall"]) for p in parts])

    table = Table(rows, hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111111")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def markdown_to_flowables(markdown: str) -> list:
    story: list = []
    paragraph: list[str] = []
    bullets: list[str] = []
    table_lines: list[str] = []

    def flush_paragraph():
        if paragraph:
            text = " ".join(paragraph).strip()
            if text:
                story.append(Paragraph(inline_markup(text), STYLES["TankBody"]))
            paragraph.clear()

    def flush_bullets():
        if bullets:
            items = [
                ListItem(Paragraph(inline_markup(item), STYLES["TankBody"]), leftIndent=8)
                for item in bullets
            ]
            story.append(ListFlowable(items, bulletType="bullet", leftIndent=12, bulletFontName=FONT))
            story.append(Spacer(1, 3))
            bullets.clear()

    def flush_table():
        if table_lines:
            story.append(table_from_lines(table_lines))
            story.append(Spacer(1, 7))
            table_lines.clear()

    for raw in markdown.splitlines():
        line = clean_line(raw)
        stripped = line.strip()

        if not stripped:
            flush_paragraph()
            flush_bullets()
            flush_table()
            continue

        if stripped == "---":
            flush_paragraph()
            flush_bullets()
            flush_table()
            story.append(Spacer(1, 8))
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            flush_paragraph()
            flush_bullets()
            table_lines.append(stripped)
            continue

        flush_table()

        if stripped.startswith("#"):
            flush_paragraph()
            flush_bullets()
            level = len(stripped) - len(stripped.lstrip("#"))
            text = stripped[level:].strip()
            style = "TankH1" if level <= 2 else "TankH2"
            story.append(Paragraph(inline_markup(text), STYLES[style]))
            continue

        bullet_match = re.match(r"^(\*|-|\d+\.)\s+(.*)", stripped)
        if bullet_match:
            flush_paragraph()
            bullets.append(bullet_match.group(2))
            continue

        flush_bullets()
        paragraph.append(stripped)

    flush_paragraph()
    flush_bullets()
    flush_table()
    return story


def draw_watermark(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(OFF_WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # Right-side TANK-inspired mark: a restrained echo of the reference PDF,
    # updated with the current site's teal/lime digital palette.
    canvas.setFillAlpha(0.9)
    shapes = [
        (PAGE_W - 34 * mm, PAGE_H - 158 * mm, 42 * mm, 15 * mm, TEAL),
        (PAGE_W - 40 * mm, PAGE_H - 230 * mm, 52 * mm, 24 * mm, TEAL),
        (PAGE_W - 28 * mm, PAGE_H - 102 * mm, 30 * mm, 13 * mm, LIME),
        (PAGE_W - 23 * mm, PAGE_H - 267 * mm, 25 * mm, 18 * mm, LIME),
    ]
    for x, y, w, h, colour in shapes:
        canvas.setFillColor(colour)
        p = canvas.beginPath()
        p.moveTo(x, y)
        p.lineTo(x + w, y + h * 0.18)
        p.lineTo(x + w * 0.82, y + h)
        p.lineTo(x + w * 0.08, y + h * 0.82)
        p.close()
        canvas.drawPath(p, stroke=0, fill=1)

    canvas.setFillAlpha(0.08)
    canvas.setFillColor(INK)
    canvas.setFont(BOLD, 58)
    canvas.rotate(90)
    canvas.drawString(132 * mm, -197 * mm, "TANK")
    canvas.restoreState()

    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(22 * mm, PAGE_H - 25 * mm, PAGE_W - 28 * mm, PAGE_H - 25 * mm)
    if LOGO.exists():
        canvas.drawImage(str(LOGO), 22 * mm, PAGE_H - 18 * mm, width=38 * mm, height=10 * mm, mask="auto")
    else:
        canvas.setFont(BOLD, 18)
        canvas.setFillColor(INK)
        canvas.drawString(22 * mm, PAGE_H - 17 * mm, "TANK")
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - 22 * mm, 13 * mm, f"Windows EC2 SDP Campaign 1 | April 2026 | {doc.page}")
    canvas.restoreState()


def cover_story(title: str, source_file: str) -> list:
    story: list = []
    if HERO.exists():
        # A slim image band gives the partner PDF the current TANK digital feel
        # while keeping the campaign content as the main event.
        with PILImage.open(HERO) as im:
            ratio = im.width / im.height
        img_w = 150 * mm
        img_h = img_w / ratio
        story.append(Image(str(HERO), width=img_w, height=img_h))
        story.append(Spacer(1, 12))
    story.append(Paragraph(title, STYLES["TankTitle"]))
    story.append(
        Paragraph(
            "Partner-ready campaign detail pack prepared in the TANK visual style for Cloudwrxs.",
            STYLES["TankBody"],
        )
    )
    story.append(Spacer(1, 10))
    meta = [
        ["Campaign", "Windows EC2 SDP Campaign 1"],
        ["Campaign month", "April 2026"],
        ["Source markdown", source_file],
        ["Prepared by", "TANK.co.uk"],
    ]
    table = Table(
        [[Paragraph(f"<b>{html.escape(a)}</b>", STYLES["TankSmall"]), Paragraph(html.escape(b), STYLES["TankSmall"])] for a, b in meta],
        colWidths=[36 * mm, 92 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#111111")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(table)
    story.append(PageBreak())
    return story


def render_pdf(md_file: Path) -> Path:
    raw = md_file.read_text(encoding="utf-8")
    april_markdown = pdf_text_for_april(raw)
    title = title_from_md(md_file, april_markdown)

    out = OUTPUT_DIR / f"windows-ec2-sdp-campaign-1-{md_file.stem}-april-2026.pdf"
    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        rightMargin=26 * mm,
        leftMargin=22 * mm,
        topMargin=34 * mm,
        bottomMargin=20 * mm,
        title=title,
        author="TANK.co.uk",
    )
    story = cover_story(title, md_file.name)
    story.extend(markdown_to_flowables(april_markdown))
    doc.build(story, onFirstPage=draw_watermark, onLaterPages=draw_watermark)
    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_files = sorted(CAMPAIGN_DIR.glob("*.md"))
    outputs = [render_pdf(path) for path in md_files]
    for path in outputs:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
