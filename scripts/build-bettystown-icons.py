#!/usr/bin/env python3
"""Generate OG preview + iOS Home Screen icons for Mom's Bettystown Weather."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sites" / "bettystown"

SKY = (232, 244, 252)
SKY2 = (184, 223, 245)
SUN = (255, 183, 3)
SEA = (0, 119, 182)
MINT = (6, 214, 160)
INK = (13, 33, 55)
WHITE = (255, 255, 255)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def draw_sky_bg(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    for y in range(h):
        t = y / max(h - 1, 1)
        c = (lerp(SKY[0], SKY2[0], t), lerp(SKY[1], SKY2[1], t), lerp(SKY[2], SKY2[2], t))
        draw.line([(0, y), (w, y)], fill=c)


def draw_sun(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    for i in range(3, 0, -1):
        glow = r + i * 18
        alpha = 40 + i * 20
        draw.ellipse((cx - glow, cy - glow, cx + glow, cy + glow), fill=SUN + (alpha,))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SUN + (255,))


def draw_waves(draw: ImageDraw.ImageDraw, w: int, base_y: int, amp: int) -> None:
    for x in range(0, w + 20, 20):
        draw.arc((x - 30, base_y - amp, x + 30, base_y + amp), 0, 180, fill=SEA + (180,), width=4)


def draw_icon_square(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), SKY + (255,))
    draw = ImageDraw.Draw(img)
    draw_sky_bg(draw, size, size)
    draw_sun(draw, int(size * 0.72), int(size * 0.28), int(size * 0.14))
    draw_waves(draw, size, int(size * 0.78), int(size * 0.04))

    paw = int(size * 0.22)
    px, py = int(size * 0.5), int(size * 0.58)
    for ox, oy in [(0, 0), (-paw // 2, -paw // 2), (paw // 2, -paw // 2), (-paw // 3, -paw), (paw // 3, -paw)]:
        r = paw // 3 if oy < 0 else paw // 2
        draw.ellipse((px + ox - r, py + oy - r, px + ox + r, py + oy + r), fill=INK + (230,))

    f = font(max(10, size // 9), bold=True)
    label = "Mom's"
    tw = draw.textlength(label, font=f)
    draw.text(((size - tw) / 2, size * 0.08), label, fill=INK + (255,), font=f)
    return img


def draw_og_preview() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGBA", (w, h), SKY + (255,))
    draw = ImageDraw.Draw(img)
    draw_sky_bg(draw, w, h)
    draw_sun(draw, 980, 120, 90)
    draw_waves(draw, w, 520, 28)
    draw.rectangle((0, 480, w, h), fill=SEA + (255,))

    title_f = font(72, bold=True)
    sub_f = font(36)
    small_f = font(28)

    draw.text((64, 80), "Mom's Bettystown Weather", fill=INK + (255,), font=title_f)
    draw.text((64, 170), "Warm, dry beach days for Mom & Max", fill=SEA + (255,), font=sub_f)
    draw.text((64, 240), "☀️ 14-day forecast  ·  🐕 dog-friendly walk scores", fill=INK + (200,), font=small_f)

    card_w, card_h = 280, 140
    for i, (score, day, temp) in enumerate([(86, "Best day", "19°C"), (74, "Low rain", "17°C"), (68, "Gentle wind", "16°C")]):
        x = 64 + i * (card_w + 24)
        y = 320
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=20, fill=WHITE + (245,), outline=MINT + (255,), width=3)
        draw.text((x + 20, y + 18), day, fill=INK + (255,), font=font(26, bold=True))
        draw.text((x + 20, y + 58), f"Walk score {score}", fill=SEA + (255,), font=font(24))
        draw.text((x + 20, y + 96), temp, fill=INK + (180,), font=font(22))

    paw_f = font(120)
    draw.text((980, 360), "🐕", fill=INK + (255,), font=paw_f)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)
    draw_og_preview().convert("RGB").save(OUT / "og-preview.png", optimize=True)
    draw_icon_square(180).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    draw_icon_square(192).convert("RGB").save(OUT / "icons" / "icon-192.png", optimize=True)
    draw_icon_square(512).convert("RGB").save(OUT / "icons" / "icon-512.png", optimize=True)
    draw_icon_square(32).convert("RGB").save(OUT / "favicon-32.png", optimize=True)
    print("Wrote Bettystown icons to", OUT)


if __name__ == "__main__":
    main()
