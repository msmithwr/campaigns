from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CLIPS = ROOT / "output" / "video-generation" / "grok-clips" / "text-free" / "raw"
LOGO = ROOT / "output" / "video-generation" / "grok-references" / "cloudwrxs-logo-light.png"
VOICE = ROOT / "output" / "voice-generation"
OUT = ROOT / "output" / "video-generation" / "grok-final"
WORK = OUT / "_work"

W, H = 1920, 1080
FPS = 30

FFMPEG = Path(imageio_ffmpeg.get_ffmpeg_exe())

FONT_EN = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_AR = "/System/Library/Fonts/GeezaPro.ttc"
FONT_AR_ALT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

COLORS = {
    "navy": (6, 23, 35, 225),
    "navy_solid": (6, 23, 35, 255),
    "panel": (5, 28, 42, 200),
    "white": (255, 255, 255, 255),
    "muted": (205, 222, 224, 255),
    "orange": (255, 111, 24, 255),
    "mint": (14, 224, 189, 255),
    "blue": (30, 140, 255, 255),
}

SEQUENCE = [
    ("clip-01-windows-estate-pressure.mp4", "Modernise Windows. Reduce risk.", "See where cost, resilience, and support exposure are building up."),
    ("clip-02-cost-pressure.mp4", "Control the cost curve.", "Licensing, operations, and cloud design should work together."),
    ("clip-03-operations-security.mp4", "Secure the estate before change.", "Identify the risks before they become migration blockers."),
    ("clip-04-migration.mp4", "Move workloads with AWS SDP.", "A structured path from legacy Windows estates to AWS."),
    ("clip-05-roadmap.mp4", "A practical roadmap, not another theory.", "Prioritised actions your teams can run with."),
    ("clip-06-savings.mp4", "Optimise licensing and operating cost.", "Reduce waste while improving the shape of the platform."),
    ("clip-07-performance.mp4", "Improve resilience and performance.", "Modern cloud patterns for critical Windows workloads."),
    ("clip-08-security.mp4", "Security and compliance built in.", "Design controls into the operating model from the start."),
    ("clip-09-it-team.mp4", "Give IT time back for strategy.", "Move from maintenance pressure to measurable improvement."),
    ("clip-10-cta-background.mp4", "Book a Windows SDP assessment.", "Cloudwrxs will help you find the next best move."),
]

SEQUENCE_AR = [
    ("clip-01-windows-estate-pressure.mp4", "تحديث Windows وتقليل المخاطر", "رؤية أوضح للتكلفة والاعتمادية ومخاطر الدعم."),
    ("clip-02-cost-pressure.mp4", "تحكم أفضل في منحنى التكلفة", "التراخيص والتشغيل وتصميم السحابة يجب أن تعمل معاً."),
    ("clip-03-operations-security.mp4", "تأمين البيئة قبل التغيير", "اكتشاف المخاطر قبل أن تصبح عائقاً في التحديث."),
    ("clip-04-migration.mp4", "نقل الأحمال عبر AWS SDP", "مسار منظم من بيئات Windows القديمة إلى AWS."),
    ("clip-05-roadmap.mp4", "خطة عملية وليست نظرية", "أولويات واضحة يمكن للفِرق تنفيذها."),
    ("clip-06-savings.mp4", "تحسين التراخيص والتكلفة التشغيلية", "تقليل الهدر مع تحسين شكل المنصة."),
    ("clip-07-performance.mp4", "رفع الاعتمادية والأداء", "أنماط سحابية حديثة لأحمال Windows الحرجة."),
    ("clip-08-security.mp4", "أمان وامتثال مدمجان", "بناء الضوابط داخل نموذج التشغيل من البداية."),
    ("clip-09-it-team.mp4", "إعادة وقت فريق التقنية للاستراتيجية", "الانتقال من ضغط الصيانة إلى تحسين قابل للقياس."),
    ("clip-10-cta-background.mp4", "احجز جلسة تقييم Windows SDP", "Cloudwrxs تساعدك في تحديد الخطوة الصحيحة التالية."),
]


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def duration(path: Path) -> float:
    proc = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(path)],
        stderr=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        check=False,
    )
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not match:
        raise RuntimeError(f"Could not read duration for {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def font(size: int, bold: bool = False, ar: bool = False) -> ImageFont.FreeTypeFont:
    if ar:
        for path in (FONT_AR, FONT_AR_ALT):
            try:
                return ImageFont.truetype(path, size=size, index=1 if bold else 0)
            except Exception:
                continue
    return ImageFont.truetype(FONT_EN, size=size, index=1 if bold else 0)


def wrap(draw: ImageDraw.ImageDraw, value: str, max_width: int, size: int, bold: bool, ar: bool) -> list[str]:
    words = value.split()
    lines: list[str] = []
    current = ""
    fnt = font(size, bold=bold, ar=ar)
    for word in words:
        trial = word if not current else f"{current} {word}"
        bbox = draw.textbbox((0, 0), trial, font=fnt, direction="rtl" if ar else None)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    value: str,
    x: int,
    y: int,
    max_width: int,
    size: int,
    fill: tuple[int, int, int, int],
    bold: bool = False,
    ar: bool = False,
    line_gap: int = 12,
) -> int:
    lines = wrap(draw, value, max_width, size, bold, ar)
    line_h = size + line_gap
    for idx, line in enumerate(lines):
        draw.text(
            (x + max_width if ar else x, y + idx * line_h),
            line,
            font=font(size, bold=bold, ar=ar),
            fill=fill,
            direction="rtl" if ar else None,
            anchor="ra" if ar else None,
        )
    return y + len(lines) * line_h


def overlay(path: Path, title: str, sub: str, clip_index: int, lang: str) -> None:
    ar = lang == "ar"
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Brand plate keeps the real logo crisp and hides any tiny lower-layer artefacts nearby.
    draw.rounded_rectangle((54, 42, 560, 138), radius=24, fill=COLORS["navy"])
    logo = Image.open(LOGO).convert("RGBA")
    logo.thumbnail((420, 58), Image.Resampling.LANCZOS)
    img.alpha_composite(logo, (90, 62))

    # Campaign tag
    draw.rounded_rectangle((1460, 50, 1846, 124), radius=22, fill=(255, 111, 24, 225))
    draw.text((1653, 71), "Windows SDP", font=font(30, True), fill=COLORS["white"], anchor="ma")

    # Lower third hides any generated UI-like marks and carries all readable copy.
    draw.rounded_rectangle((72, 702, 1430, 1000), radius=36, fill=COLORS["panel"])
    draw.rectangle((112, 740, 288, 752), fill=COLORS["orange"])
    title_bottom = draw_wrapped(
        draw,
        title,
        112 if not ar else 130,
        790,
        1180,
        54,
        COLORS["white"],
        bold=True,
        ar=ar,
        line_gap=6,
    )
    draw_wrapped(
        draw,
        sub,
        112 if not ar else 130,
        title_bottom + 18,
        1120,
        30,
        COLORS["muted"],
        bold=False,
        ar=ar,
        line_gap=8,
    )

    # CTA on final slide.
    total = len(SEQUENCE)
    if clip_index == total - 1:
        draw.rounded_rectangle((1380, 738, 1846, 850), radius=28, fill=(14, 224, 189, 235))
        cta = "cloudwrxs.com/windows-sdp2" if not ar else "cloudwrxs.com/windows-sdp2"
        draw.text((1613, 774), cta, font=font(24, True), fill=(4, 25, 36, 255), anchor="ma")
        draw.rounded_rectangle((1380, 872, 1846, 954), radius=24, outline=COLORS["orange"], width=4)
        draw.text(
            (1613, 893),
            "Book a 20 min review" if not ar else "احجز مراجعة 20 دقيقة",
            font=font(25, True, ar=ar),
            fill=COLORS["white"],
            anchor="ma",
            direction="rtl" if ar else None,
        )
    else:
        # Progress marker
        cx = 1510
        cy = 898
        for i in range(total):
            x = cx + i * 30
            fill = COLORS["mint"] if i <= clip_index else (255, 255, 255, 90)
            draw.ellipse((x, cy, x + 14, cy + 14), fill=fill)

    img.save(path)


def segment(src: Path, overlay_png: Path, out: Path, target_duration: float) -> None:
    src_duration = duration(src)
    factor = target_duration / src_duration
    filters = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},fps={FPS},setpts={factor:.8f}*PTS,"
        "eq=brightness=-0.035:saturation=0.97[bg];"
        "[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(src),
            "-i",
            str(overlay_png),
            "-filter_complex",
            filters,
            "-map",
            "[v]",
            "-t",
            f"{target_duration:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(out),
        ]
    )


def build(lang: str, items: list[tuple[str, str, str]], audio: Path, final: Path) -> None:
    work = WORK / lang
    work.mkdir(parents=True, exist_ok=True)
    audio_duration = duration(audio)
    # Keep the visual track a little longer than the narration, then let the
    # final mux trim to the audio. This avoids losing the final word when frame
    # rounding or source clip cadence shaves a few frames off each segment.
    per_clip = (audio_duration + 2.0) / len(items)
    segments: list[Path] = []
    for idx, (clip_name, title, sub) in enumerate(items):
        overlay_png = work / f"overlay-{idx + 1:02d}.png"
        seg = work / f"segment-{idx + 1:02d}.mp4"
        overlay(overlay_png, title, sub, idx, lang)
        segment(CLIPS / clip_name, overlay_png, seg, per_clip)
        segments.append(seg)

    concat = work / "concat.txt"
    concat.write_text("".join(f"file '{seg.as_posix()}'\n" for seg in segments), encoding="utf-8")
    silent = work / f"{final.stem}.silent.mp4"
    run([str(FFMPEG), "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(silent)])
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(silent),
            "-i",
            str(audio),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(final),
        ]
    )


def main() -> None:
    if WORK.exists():
        shutil.rmtree(WORK)
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)

    build(
        "en",
        SEQUENCE,
        VOICE / "cloudwrxs-windows-sdp2-voiceover-en-ryan-cloudworks-oneword.mp3",
        OUT / "cloudwrxs-windows-sdp2-explainer-en-grok-text-free.mp4",
    )
    build(
        "ar",
        SEQUENCE_AR,
        VOICE / "cloudwrxs-windows-sdp2-voiceover-ar-hamed-cloudworks-oneword.mp3",
        OUT / "cloudwrxs-windows-sdp2-explainer-ar-grok-text-free.mp4",
    )


if __name__ == "__main__":
    main()
