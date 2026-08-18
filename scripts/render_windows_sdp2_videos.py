from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "video-generation" / "renders"
VOICE = ROOT / "output" / "voice-generation"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080
FPS = 30

COLORS = {
    "ink": (25, 31, 42),
    "muted": (92, 108, 115),
    "line": (215, 228, 228),
    "paper": (247, 250, 250),
    "white": (255, 255, 255),
    "blue": (20, 100, 185),
    "blue_dark": (10, 62, 120),
    "orange": (255, 111, 24),
    "orange_soft": (255, 236, 224),
    "green": (0, 108, 53),
    "mint": (14, 224, 189),
    "mint_soft": (226, 255, 248),
    "red": (205, 76, 57),
    "amber": (245, 172, 62),
}

FONT_EN = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_AR = "/System/Library/Fonts/GeezaPro.ttc"
FONT_AR_ALT = "/System/Library/Fonts/SFArabic.ttf"


def font(size: int, bold: bool = False, ar: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_AR if ar else FONT_EN
    index = 1 if bold else 0
    try:
        return ImageFont.truetype(path, size=size, index=index)
    except Exception:
        return ImageFont.truetype(FONT_AR_ALT if ar else "/System/Library/Fonts/Supplemental/Arial.ttf", size=size)


def is_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06ff" for ch in text)


def shape_text(text: str) -> str:
    return text


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def lerp(a: float, b: float, x: float) -> float:
    return a + (b - a) * x


def draw_gradient() -> Image.Image:
    x = np.linspace(0, 1, W, dtype=np.float32)
    y = np.linspace(0, 1, H, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    k = (xx * 0.55) + (yy * 0.45)
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    arr[:, :, 0] = np.clip(247 - 14 * k, 0, 255).astype(np.uint8)
    arr[:, :, 1] = np.clip(250 - 18 * k, 0, 255).astype(np.uint8)
    arr[:, :, 2] = np.clip(250 - 18 * k, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB")


BASE_BG = draw_gradient().convert("RGBA")


def rounded(draw: ImageDraw.ImageDraw, box, radius=24, fill=None, outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy, value: str, size=42, fill=None, bold=False, anchor=None, ar=False):
    fill = fill or COLORS["ink"]
    ar = ar or is_arabic(value)
    draw.text(xy, value, font=font(size, bold=bold, ar=ar), fill=fill, anchor=anchor, direction="rtl" if ar else None)


def wrap_text(draw: ImageDraw.ImageDraw, value: str, max_width: int, size=42, bold=False, ar=False):
    ar = ar or is_arabic(value)
    words = value.split()
    lines = []
    current = ""
    f = font(size, bold=bold, ar=ar)
    for word in words:
        trial = word if not current else current + " " + word
        bbox = draw.textbbox((0, 0), trial, font=f, direction="rtl" if ar else None)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(draw, x, y, value, max_width, size=42, fill=None, bold=False, ar=False, line_gap=12):
    ar = ar or is_arabic(value)
    lines = wrap_text(draw, value, max_width, size=size, bold=bold, ar=ar)
    line_h = size + line_gap
    for i, ln in enumerate(lines):
        xx = x + max_width if ar else x
        draw.text(
            (xx, y + i * line_h),
            ln,
            font=font(size, bold=bold, ar=ar),
            fill=fill or COLORS["ink"],
            anchor="ra" if ar else None,
            direction="rtl" if ar else None,
        )
    return y + len(lines) * line_h


def soft_shadow(img: Image.Image, box, radius=24, offset=(0, 12), blur=18):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1]), radius=radius, fill=(0, 0, 0, 34))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def logo(draw: ImageDraw.ImageDraw, lang="en"):
    x, y = 90, 64
    draw.rounded_rectangle((x, y, x + 84, y + 84), radius=22, fill=(14, 224, 189), outline=(8, 132, 116), width=2)
    text(draw, (x + 42, y + 24), "C", size=40, bold=True, fill=COLORS["ink"], anchor="ma")
    text(draw, (x + 110, y + 8), "Cloudwrxs", size=44, bold=True, fill=COLORS["ink"])
    sub = "Windows SDP campaign" if lang == "en" else "حملة تحديث الخوادم"
    paragraph(draw, x + 110, y + 58, sub, 420, size=24, fill=COLORS["muted"], ar=(lang == "ar"))


def skyline(draw: ImageDraw.ImageDraw, t: float):
    base = 860
    x0 = 0
    rng = [80, 150, 110, 220, 140, 180, 95, 260, 130, 170, 210, 120]
    x = x0
    for i, hgt in enumerate(rng * 2):
        w = 90 + (i % 3) * 26
        color = (225 - i % 5 * 5, 234 - i % 4 * 5, 234 - i % 3 * 4)
        draw.rectangle((x, base - hgt, x + w, base), fill=color)
        if i % 4 == 1:
            draw.polygon([(x + w * .45, base - hgt), (x + w * .55, base - hgt - 70), (x + w * .65, base - hgt)], fill=color)
        x += w + 18
    draw.line((0, base, W, base), fill=(210, 224, 224), width=3)


def card(img, box, fill=(255, 255, 255), outline=None, radius=30):
    soft_shadow(img, box, radius=radius)
    d = ImageDraw.Draw(img)
    rounded(d, box, radius=radius, fill=fill, outline=outline or COLORS["line"], width=2)


def draw_dashboard(draw, x, y, w, h, p=1.0, title="Windows Server Estate", ar=False):
    rounded(draw, (x, y, x + w, y + h), 26, fill=COLORS["white"], outline=COLORS["line"], width=2)
    text(draw, (x + 32, y + 28), title, size=28, bold=True, fill=COLORS["ink"], ar=ar)
    for i in range(4):
        yy = y + 95 + i * 62
        draw.rounded_rectangle((x + 32, yy, x + w - 32, yy + 38), radius=12, fill=(244, 248, 248))
        fillw = int((w - 100) * min(1, p * (0.45 + i * .16)))
        col = [COLORS["orange"], COLORS["amber"], COLORS["red"], COLORS["blue"]][i]
        draw.rounded_rectangle((x + 42, yy + 9, x + 42 + fillw, yy + 29), radius=9, fill=col)
    for i, lab in enumerate(["Cost", "Ops", "Risk"]):
        bx = x + 36 + i * ((w - 88) // 3)
        by = y + h - 112
        draw.rounded_rectangle((bx, by, bx + 125, by + 72), radius=16, fill=(255, 246, 240) if i == 0 else (238, 248, 255))
        text(draw, (bx + 18, by + 15), lab, size=21, bold=True, fill=COLORS["muted"])


def scene_1(draw, img, local, lang):
    skyline(draw, local)
    ar = lang == "ar"
    title = "Windows infrastructure is becoming expensive and complex" if not ar else "بنية الخوادم أصبحت أكثر تكلفة وتعقيداً"
    paragraph(draw, 90 if not ar else 90, 210, title, 1040 if not ar else 760, size=66, bold=True, fill=COLORS["ink"], ar=ar, line_gap=8)
    card(img, (970, 305, 1770, 800))
    draw_dashboard(draw, 1010, 345, 720, 410, ease(local), "Windows Server Estate" if not ar else "بيئة الخوادم", ar=ar)
    # IT manager silhouette
    cx = 760 + int(20 * math.sin(local * math.pi * 2))
    draw.ellipse((cx, 560, cx + 88, 648), fill=(46, 71, 94))
    draw.rounded_rectangle((cx - 44, 642, cx + 132, 840), radius=50, fill=(55, 92, 128))
    # Warning bubbles
    for i, (bx, by, label) in enumerate([(1160, 220, "+12%"), (1370, 235, "!"), (1570, 210, "Risk")]):
        s = ease(local - i * .12)
        if s > 0:
            draw.ellipse((bx, by, bx + 90 * s, by + 90 * s), fill=COLORS["orange"] if i == 0 else COLORS["red"])
            text(draw, (bx + 45 * s, by + 25 * s), label, size=24, bold=True, fill=COLORS["white"], anchor="ma")


def scene_2(draw, img, local, lang):
    ar = lang == "ar"
    title = "High costs, manual maintenance, and security risk slow the business" if not ar else "التكاليف والصيانة اليدوية والمخاطر الأمنية تبطئ الأعمال"
    paragraph(draw, 90 if not ar else 700, 122, title, 1120, size=58, bold=True, ar=ar)
    labels_en = [("Licensing costs", "40-60% savings"), ("Manual tasks", "Patching • Backup"), ("Security risk", "Compliance gaps")]
    labels_ar = [("تكاليف التراخيص", "فرصة توفير 40-60%"), ("مهام يدوية", "تحديثات • نسخ احتياطي"), ("مخاطر أمنية", "فجوات امتثال")]
    labels = labels_ar if ar else labels_en
    for i, (h1, h2) in enumerate(labels):
        x = 100 + i * 590
        y = 340
        card(img, (x, y, x + 520, y + 490), fill=COLORS["white"])
        text(draw, (x + 40 if not ar else x + 480, y + 38), h1, size=38, bold=True, fill=COLORS["ink"], ar=ar, anchor="ra" if ar else None)
        text(draw, (x + 40 if not ar else x + 480, y + 94), h2, size=28, bold=True, fill=COLORS["muted"], ar=ar, anchor="ra" if ar else None)
        if i == 0:
            for b in range(5):
                hh = int(50 + 270 * ease(local) * (b + 1) / 5)
                draw.rounded_rectangle((x + 80 + b * 70, y + 420 - hh, x + 125 + b * 70, y + 420), radius=10, fill=COLORS["orange"])
            draw.line((x + 70, y + 420, x + 440, y + 420), fill=COLORS["line"], width=3)
        elif i == 1:
            for b in range(5):
                yy = y + 165 + b * 48
                draw.rounded_rectangle((x + 70, yy, x + 440, yy + 34), radius=12, fill=(244, 248, 248), outline=COLORS["line"])
                draw.ellipse((x + 85, yy + 9, x + 101, yy + 25), fill=COLORS["amber"])
        else:
            draw.polygon((x + 255, y + 170, x + 390, y + 235, x + 360, y + 390, x + 255, y + 445, x + 150, y + 390, x + 120, y + 235), fill=COLORS["orange_soft"], outline=COLORS["red"])
            text(draw, (x + 255, y + 265), "!", size=100, bold=True, fill=COLORS["red"], anchor="ma")


def scene_3(draw, img, local, lang):
    ar = lang == "ar"
    title = "AWS SDP with Cloudwrxs transforms Windows infrastructure" if not ar else "مسار عملي لتحديث البنية وتقليل التكلفة"
    paragraph(draw, 130 if not ar else 580, 110, title, 1220, size=60, bold=True, ar=ar)
    # server stack
    sx, sy = 170, 420
    for i in range(4):
        draw.rounded_rectangle((sx, sy + i * 78, sx + 380, sy + 55 + i * 78), radius=14, fill=(226, 236, 238), outline=COLORS["line"], width=2)
        draw.ellipse((sx + 24, sy + 17 + i * 78, sx + 44, sy + 37 + i * 78), fill=COLORS["red"] if i < 2 else COLORS["amber"])
    # cloud
    cloud_x = int(1260 - 160 * (1 - ease(local)))
    cy = 540
    for r in [(cloud_x, cy + 40, cloud_x + 360, cy + 160), (cloud_x + 70, cy - 20, cloud_x + 210, cy + 130), (cloud_x + 190, cy, cloud_x + 410, cy + 160)]:
        draw.ellipse(r, fill=COLORS["mint_soft"], outline=COLORS["mint"], width=5)
    draw.rounded_rectangle((cloud_x + 55, cy + 95, cloud_x + 410, cy + 185), radius=35, fill=COLORS["mint_soft"], outline=COLORS["mint"], width=5)
    text(draw, (cloud_x + 230, cy + 105), "AWS SDP", size=48, bold=True, fill=COLORS["blue"], anchor="ma")
    # flow
    for i in range(6):
        x1 = 610 + i * 90
        y1 = 590 + math.sin(local * math.pi * 2 + i) * 18
        draw.ellipse((x1, y1, x1 + 24, y1 + 24), fill=COLORS["orange"])
    draw.line((560, 610, cloud_x - 30, 610), fill=COLORS["blue"], width=8)
    # advisor card
    card(img, (680, 705, 1220, 875), fill=COLORS["orange_soft"], outline=(255, 190, 155))
    text(draw, (715, 735), "Cloudwrxs", size=44, bold=True, fill=COLORS["ink"])
    text(draw, (715, 795), "AWS Advanced Partner", size=30, bold=True, fill=COLORS["muted"])


def scene_4(draw, img, local, lang):
    ar = lang == "ar"
    items_en = [
        ("40-60%", "Reduce Windows licensing costs", COLORS["orange"]),
        ("UP", "Improve performance and resilience", COLORS["blue"]),
        ("OK", "Strengthen security and compliance", COLORS["green"]),
        ("Auto", "Simplify operations and free IT teams", COLORS["mint"]),
    ]
    items_ar = [
        ("40-60%", "خفض تكاليف التراخيص", COLORS["orange"]),
        ("UP", "تحسين الأداء والمرونة", COLORS["blue"]),
        ("OK", "تعزيز الأمان والامتثال", COLORS["green"]),
        ("Auto", "تبسيط العمليات وتحرير فرق التقنية", COLORS["mint"]),
    ]
    items = items_ar if ar else items_en
    title = "The business case becomes clear" if not ar else "تصبح قيمة التحول واضحة"
    paragraph(draw, 100 if not ar else 730, 170, title, 1080, size=58, bold=True, ar=ar)
    for i, (big, label, col) in enumerate(items):
        p = ease((local * 4) - i)
        x = 120 + (i % 2) * 850
        y = 285 + (i // 2) * 320
        dy = int((1 - p) * 40)
        card(img, (x, y + dy, x + 760, y + 260 + dy), fill=COLORS["white"])
        draw.ellipse((x + 42, y + 48 + dy, x + 172, y + 178 + dy), fill=col)
        text(draw, (x + 107, y + 78 + dy), big, size=44 if len(big) < 5 else 36, bold=True, fill=COLORS["white"], anchor="ma")
        paragraph(draw, x + 210 if not ar else x + 220, y + 70 + dy, label, 490, size=38, bold=True, fill=COLORS["ink"], ar=ar)
        # mini chart
        for b in range(6):
            val = p * (b + 2) / 8
            draw.rounded_rectangle((x + 230 + b * 70, y + 188 + dy - int(75 * val), x + 270 + b * 70, y + 188 + dy), radius=10, fill=col)


def scene_5(draw, img, local, lang):
    ar = lang == "ar"
    title = "Real transformation. Measurable business outcomes." if not ar else "تحول عملي ونتائج أعمال قابلة للقياس"
    paragraph(draw, 110 if not ar else 610, 120, title, 1200, size=60, bold=True, ar=ar)
    # before after building/dashboard
    card(img, (130, 340, 880, 820), fill=(252, 252, 252))
    card(img, (1030, 340, 1780, 820), fill=COLORS["mint_soft"], outline=COLORS["mint"])
    text(draw, (170, 380), "Before" if not ar else "قبل", size=42, bold=True, fill=COLORS["muted"], ar=ar)
    text(draw, (1070, 380), "After" if not ar else "بعد", size=42, bold=True, fill=COLORS["green"], ar=ar)
    for i, metric in enumerate([("45%", "Cost reduction"), ("60%", "Efficiency improvement"), ("0", "Downtime incidents")]):
        x = 1090 + i * 215
        y = 515
        draw.ellipse((x, y, x + 155, y + 155), fill=COLORS["white"], outline=COLORS["mint"], width=5)
        text(draw, (x + 78, y + 38), metric[0], size=42, bold=True, fill=COLORS["green"], anchor="ma")
        paragraph(draw, x - 20, y + 185, metric[1] if not ar else ["خفض التكلفة", "تحسين الكفاءة", "انقطاع الخدمة"][i], 210, size=24, bold=True, fill=COLORS["muted"], ar=ar)
    # before warning blocks
    for i in range(4):
        draw.rounded_rectangle((210, 490 + i * 65, 760, 535 + i * 65), radius=12, fill=(255, 239, 235), outline=(245, 190, 180))
        draw.ellipse((230, 502 + i * 65, 250, 522 + i * 65), fill=COLORS["red"])


def scene_6(draw, img, local, lang):
    ar = lang == "ar"
    title = "Book your free Windows Migration Readiness Assessment" if not ar else "احجز تقييم جاهزية الترحيل مجاناً"
    paragraph(draw, 180 if not ar else 520, 190, title, 1220, size=72, bold=True, fill=COLORS["ink"], ar=ar)
    subtitle = "See the savings opportunity, migration path, and next steps." if not ar else "تعرف على فرصة التوفير، ومسار الترحيل، والخطوات التالية."
    paragraph(draw, 185 if not ar else 665, 390, subtitle, 1050, size=40, fill=COLORS["muted"], ar=ar)
    # CTA button
    bx, by = 185, 570
    if ar:
        bx = 1130
    draw.rounded_rectangle((bx, by, bx + 600, by + 110), radius=38, fill=COLORS["orange"])
    text(draw, (bx + 300, by + 30), "Book free assessment" if not ar else "احجز التقييم المجاني", size=38, bold=True, fill=COLORS["white"], anchor="ma", ar=ar)
    # Contact card
    card(img, (1040 if not ar else 150, 570, 1760 if not ar else 870, 840), fill=COLORS["white"])
    text(draw, (1085 if not ar else 820, 615), "Cloudwrxs" if not ar else "Cloudwrxs", size=48, bold=True, fill=COLORS["ink"], anchor="ra" if ar else None)
    paragraph(draw, 1085 if not ar else 250, 690, "Windows SDP assessment for KSA/MENA organisations" if not ar else "تقييم للمؤسسات في السعودية والمنطقة", 590, size=30, fill=COLORS["muted"], ar=ar)
    draw.rounded_rectangle((1085 if not ar else 250, 765, 1650 if not ar else 815, 815), radius=18, fill=COLORS["mint_soft"], outline=COLORS["mint"], width=2)
    text(draw, (1110 if not ar else 790, 774), "/windows-sdp2/", size=28, bold=True, fill=COLORS["green"], ar=False, anchor="ra" if ar else None)


SCENE_FUNCS = [scene_1, scene_2, scene_3, scene_4, scene_5, scene_6]
BASE_CUTS = [0, 8, 18, 28, 48, 55, 60]


def make_frame(t: float, total: float, lang: str) -> Image.Image:
    scale = total / 60.0
    cuts = [c * scale for c in BASE_CUTS]
    idx = 0
    for i in range(len(cuts) - 1):
        if cuts[i] <= t < cuts[i + 1]:
            idx = i
            break
    local = (t - cuts[idx]) / max(0.01, cuts[idx + 1] - cuts[idx])
    img = BASE_BG.copy()
    d = ImageDraw.Draw(img)
    # subtle moving background geometry
    for i in range(8):
        x = int((i * 300 + t * 12) % (W + 300) - 150)
        y = 120 + i * 100
        d.line((x, y, x + 240, y + 180), fill=(221, 235, 235, 120), width=2)
    logo(d, lang)
    # progress bar
    d.rounded_rectangle((90, 1000, 1830, 1014), radius=7, fill=(225, 235, 235))
    d.rounded_rectangle((90, 1000, 90 + int(1740 * min(1, t / total)), 1014), radius=7, fill=COLORS["mint"])
    SCENE_FUNCS[idx](d, img, local, lang)
    return img.convert("RGB")


def media_duration(path: Path) -> float:
    out = subprocess.check_output(["afinfo", str(path)], text=True)
    m = re.search(r"estimated duration: ([0-9.]+)", out)
    if not m:
        raise RuntimeError(f"Could not read duration for {path}")
    return float(m.group(1))


def render(lang: str, audio: Path, output: Path):
    duration = media_duration(audio)
    silent = output.with_suffix(".silent.mp4")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    writer = imageio_ffmpeg.write_frames(
        str(silent),
        (W, H),
        fps=FPS,
        codec="libx264",
        quality=8,
        macro_block_size=1,
        pix_fmt_in="rgb24",
        output_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
    )
    writer.send(None)
    frames = int(math.ceil(duration * FPS))
    for n in range(frames):
        t = n / FPS
        frame = make_frame(t, duration, lang)
        writer.send(np.asarray(frame))
        if n and n % 300 == 0:
            print(f"{lang}: rendered {n}/{frames} frames", flush=True)
    writer.close()
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(silent),
            "-i",
            str(audio),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(output),
        ],
        check=True,
    )
    print(f"Wrote {output}")


def main():
    render(
        "en",
        VOICE / "cloudwrxs-windows-sdp2-voiceover-en-ryan.mp3",
        OUT / "cloudwrxs-windows-sdp2-explainer-en.mp4",
    )
    render(
        "ar",
        VOICE / "cloudwrxs-windows-sdp2-voiceover-ar-hamed.mp3",
        OUT / "cloudwrxs-windows-sdp2-explainer-ar.mp4",
    )


if __name__ == "__main__":
    main()
