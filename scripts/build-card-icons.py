#!/usr/bin/env python3
"""Generate PWA / Home Screen icons that look like a mini business card."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "card"

ACCENT = (47, 57, 201)
ACCENT_2 = (71, 80, 230)
INK = (11, 15, 20)
MUTED = (63, 73, 84)
WHITE = (255, 255, 255)
SOFT = (238, 240, 254)


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


def rounded_mask(w: int, h: int, radius: int) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    return mask


def draw_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = lerp(ACCENT[0], ACCENT_2[0], t * 0.5)
        g = lerp(ACCENT[1], ACCENT_2[1], t * 0.5)
        b = lerp(ACCENT[2], ACCENT_2[2], t * 0.5)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((size * 0.02, -size * 0.08, size * 0.98, size * 0.62), fill=(255, 255, 255, 32))
    dots = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ddraw = ImageDraw.Draw(dots)
    for x, y, a in ((size * 0.12, size * 0.88, 18), (size * 0.86, size * 0.14, 14), (size * 0.78, size * 0.9, 10)):
        ddraw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(255, 255, 255, a))
    img = Image.alpha_composite(img, glow)
    return Image.alpha_composite(img, dots)


def draw_business_card(size: int) -> Image.Image:
    w = int(size - size * 0.18)
    h = int(w * 0.6)
    radius = max(8, int(size * 0.05))
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    mask = rounded_mask(w, h, radius)

    body = Image.new("RGBA", (w, h), WHITE + (255,))
    card = Image.composite(body, card, mask)

    header_h = int(h * 0.36)
    header = Image.new("RGBA", (w, header_h), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(header)
    for y in range(header_h):
        t = y / max(header_h - 1, 1)
        r = lerp(ACCENT[0], ACCENT_2[0], t * 0.35)
        g = lerp(ACCENT[1], ACCENT_2[1], t * 0.35)
        b = lerp(ACCENT[2], ACCENT_2[2], t * 0.35)
        hdraw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    header_mask = rounded_mask(w, header_h, radius)
    bottom_flat = Image.new("L", (w, header_h), 255)
    ImageDraw.Draw(bottom_flat).rectangle((0, header_h // 2, w, header_h), fill=255)
    header_mask = Image.composite(header_mask, Image.new("L", (w, header_h), 0), bottom_flat)
    card.paste(header, (0, 0), header_mask)

    draw = ImageDraw.Draw(card)
    badge = max(14, int(h * 0.19))
    bx, by = int(w * 0.08), int(h * 0.085)
    draw.rounded_rectangle((bx, by, bx + badge, by + badge), radius=max(4, int(badge * 0.22)), fill=WHITE + (245,))
    tg_font = font(max(10, int(badge * 0.46)), bold=True)
    tg = "TG"
    bb = draw.textbbox((0, 0), tg, font=tg_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((bx + (badge - tw) / 2 - bb[0], by + (badge - th) / 2 - bb[1] - 1), tg, fill=ACCENT, font=tg_font)

    compact = size < 220
    name_font = font(max(10, int(h * (0.12 if compact else 0.115))), bold=True)
    role_font = font(max(8, int(h * 0.078)))
    site_font = font(max(7, int(h * 0.068)))

    text_x = int(w * 0.08)
    name_y = int(h * 0.46)
    name = "Thomas G." if compact else "Thomas Gollogly"
    draw.text((text_x, name_y), name, fill=INK, font=name_font)
    draw.text((text_x, name_y + int(h * 0.15)), "Developer", fill=MUTED, font=role_font)
    draw.text((text_x, name_y + int(h * 0.26)), "tgollogly.dev", fill=ACCENT, font=site_font)

    line_y = int(h * 0.8)
    draw.rounded_rectangle((text_x, line_y, int(w * 0.9), line_y + max(2, int(h * 0.022))), radius=2, fill=SOFT)

    return card


def make_icon(size: int) -> Image.Image:
    canvas = draw_background(size)
    card = draw_business_card(size)
    angle = -8

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    pad = size * 0.09
    sw, sh = card.size[0] * 1.02, card.size[1] * 1.02
    cx, cy = size / 2, size / 2 + size * 0.015
    sdraw.rounded_rectangle(
        (cx - sw / 2 + size * 0.02, cy - sh / 2 + size * 0.025, cx + sw / 2 + size * 0.02, cy + sh / 2 + size * 0.025),
        radius=int(size * 0.05),
        fill=(8, 12, 40, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(2, size * 0.02)))
    canvas = Image.alpha_composite(canvas, shadow)

    rotated = card.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    rx, ry = rotated.size
    canvas.paste(rotated, (int(cx - rx / 2), int(cy - ry / 2)), rotated)
    return canvas.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = [
        (180, "apple-touch-icon.png"),
        (192, "icon-192.png"),
        (512, "icon-512.png"),
        (512, "icon-maskable-512.png", True),
    ]
    for entry in sizes:
        size, name = entry[0], entry[1]
        maskable = len(entry) > 2 and entry[2]
        img = make_icon(size)
        if maskable:
            # extra padding for Android adaptive icon safe zone
            padded = Image.new("RGB", (size, size), ACCENT)
            inner = img.resize((int(size * 0.78), int(size * 0.78)), Image.Resampling.LANCZOS)
            padded.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
            padded.save(OUT / name, optimize=True)
        else:
            img.save(OUT / name, optimize=True)
        print("Wrote", OUT / name)


if __name__ == "__main__":
    main()
