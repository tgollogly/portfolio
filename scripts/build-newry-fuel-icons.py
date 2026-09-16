#!/usr/bin/env python3
"""Generate OG preview + iOS/PWA icons for Newry Fuel Watch (heating oil + red diesel prices)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sites" / "newry-fuel"
OG_PUBLIC = ROOT / "assets" / "og" / "newry-fuel-watch.png"

# Site palette
BG_TOP = (255, 247, 237)
BG_MID = (254, 243, 199)
BG_LOW = (224, 242, 254)
INK = (15, 23, 42)
SLATE = (30, 41, 59)
ORANGE = (234, 88, 12)
ORANGE_DEEP = (194, 65, 12)
DIESEL_RED = (220, 38, 38)
DIESEL_RED_DEEP = (185, 28, 28)
TEAL = (20, 184, 166)
WHITE = (255, 255, 255)

# Representative prices shown on static art (live prices go in og:description via server)
HEATING_PPL = "107.0p"
DIESEL_PPL = "176.9p"


def font(size: int, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if serif:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        ]
    if bold:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
    candidates += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (int(lerp(c1[0], c2[0], t)), int(lerp(c1[1], c2[1], t)), int(lerp(c1[2], c2[2], t)))


def vertical_gradient(w: int, h: int, stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                local = (t - p0) / max(p1 - p0, 1e-6)
                col = lerp_rgb(c0, c1, local)
                break
        else:
            col = stops[-1][1]
        for x in range(w):
            px[x, y] = col
    return img


def draw_glass_card(base: Image.Image, box: tuple[int, int, int, int], radius: int, fill=(255, 255, 255, 220)) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=INK + (30,), width=2)
    base.alpha_composite(layer)


def draw_fuel_card(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    h: int,
    icon: str,
    label: str,
    price: str,
    accent: tuple[int, int, int],
    accent_deep: tuple[int, int, int],
    price_size: int,
) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=24, fill=WHITE + (245,), outline=accent + (200,), width=4)
    draw.rounded_rectangle((x + 4, y + 4, x + w - 4, y + 52), radius=20, fill=accent + (255,))
    draw.text((x + 18, y + 10), f"{icon}  {label}", fill=WHITE + (255,), font=font(22, bold=True))
    pf = font(price_size, bold=True)
    tw = draw.textlength(price, font=pf)
    draw.text((x + (w - tw) / 2, y + 68), price, fill=accent_deep + (255,), font=pf)
    draw.text((x + (w - draw.textlength("/litre", font=font(18)) / 2), y + 68 + price_size + 4), "/litre", fill=SLATE + (200,), font=font(18))


def draw_og_preview() -> Image.Image:
    w, h = 1200, 630
    img = vertical_gradient(w, h, [(0, BG_TOP), (0.4, BG_MID), (0.75, BG_LOW), (1.0, (186, 230, 253))]).convert("RGBA")

    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((40, 20, 420, 280), fill=ORANGE + (35,))
    gd.ellipse((780, 40, 1180, 320), fill=DIESEL_RED + (28,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(40)))

    draw_glass_card(img, (48, 48, w - 48, h - 48), radius=36)

    draw = ImageDraw.Draw(img)
    title_f = font(52, bold=True, serif=True)
    sub_f = font(26, bold=True)
    draw.text((88, 82), "Newry Fuel Watch", fill=INK + (255,), font=title_f)
    draw.text((88, 148), "Heating oil & diesel · BT35 · Northern Ireland", fill=SLATE + (255,), font=sub_f)

    draw.rounded_rectangle((88, 198, 520, 246), radius=22, fill=TEAL + (40,), outline=TEAL + (120,), width=2)
    draw.text((108, 208), "Green flash = buy now  ·  Live prices every day", fill=INK + (255,), font=font(22, bold=True))

    draw_fuel_card(draw, 88, 280, 480, 200, "🛢️", "Heating oil", HEATING_PPL, ORANGE, ORANGE_DEEP, 72)
    draw_fuel_card(draw, 632, 280, 480, 200, "⛽", "Diesel", DIESEL_PPL, DIESEL_RED, DIESEL_RED_DEEP, 72)

    draw.rounded_rectangle((88, h - 72, 420, h - 28), radius=18, fill=INK + (210,))
    draw.text((108, h - 62), "tgollogly.dev/newry-fuel", fill=WHITE + (255,), font=font(22, bold=True))
    return img


def draw_icon_square(size: int) -> Image.Image:
    img = vertical_gradient(size, size, [(0, BG_TOP), (0.55, BG_MID), (1.0, BG_LOW)]).convert("RGBA")

    pad = int(size * 0.06)
    draw = ImageDraw.Draw(img)

    # Split card: heating (orange) top, diesel (red) bottom
    mid = size // 2
    draw.rounded_rectangle((pad, pad, size - pad, mid - 2), radius=int(size * 0.12), fill=ORANGE + (255,))
    draw.rounded_rectangle((pad, mid + 2, size - pad, size - pad), radius=int(size * 0.12), fill=DIESEL_RED + (255,))

    icon_f = font(max(14, int(size * 0.14)))
    price_f = font(max(16, int(size * 0.16)), bold=True)
    small_f = font(max(9, int(size * 0.07)))

    draw.text((pad + int(size * 0.06), pad + int(size * 0.05)), "🛢️", fill=WHITE + (255,), font=icon_f)
    hp = HEATING_PPL.replace("p", "")
    draw.text((pad + int(size * 0.06), pad + int(size * 0.22)), hp, fill=WHITE + (255,), font=price_f)
    draw.text((pad + int(size * 0.06), pad + int(size * 0.38)), "oil/L", fill=WHITE + (200,), font=small_f)

    draw.text((pad + int(size * 0.06), mid + int(size * 0.05)), "⛽", fill=WHITE + (255,), font=icon_f)
    dp = DIESEL_PPL.replace("p", "")
    draw.text((pad + int(size * 0.06), mid + int(size * 0.22)), dp, fill=WHITE + (255,), font=price_f)
    draw.text((pad + int(size * 0.06), mid + int(size * 0.38)), "diesel/L", fill=WHITE + (200,), font=small_f)

    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bw = int(size * 0.52)
    bh = int(size * 0.14)
    bx = (size - bw) // 2
    by = int(size * 0.02)
    bd.rounded_rectangle((bx, by, bx + bw, by + bh), radius=int(size * 0.04), fill=INK + (230,))
    bf = font(max(10, int(size * 0.075)), bold=True)
    label = "Fuel Watch"
    tw = bd.textlength(label, font=bf)
    bd.text(((size - tw) / 2, by + int(size * 0.02)), label, fill=WHITE + (255,), font=bf)
    img.alpha_composite(badge)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)
    og = draw_og_preview().convert("RGB")
    og.save(OUT / "og-preview.png", optimize=True)
    OG_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    og.save(OG_PUBLIC, optimize=True)
    draw_icon_square(180).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    draw_icon_square(192).convert("RGB").save(OUT / "icons" / "icon-192.png", optimize=True)
    draw_icon_square(512).convert("RGB").save(OUT / "icons" / "icon-512.png", optimize=True)
    draw_icon_square(32).convert("RGB").save(OUT / "favicon-32.png", optimize=True)
    print("Wrote Newry Fuel Watch icons to", OUT)


if __name__ == "__main__":
    main()
