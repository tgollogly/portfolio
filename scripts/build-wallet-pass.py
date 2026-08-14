#!/usr/bin/env python3
"""Build a signed Apple Wallet business card (.pkpass) for Thomas Gollogly.

Requires (one-time Apple Developer setup):
  1. Enrol in the Apple Developer Program.
  2. Create a Pass Type ID (e.g. pass.dev.tgollogly.businesscard).
  3. Download the Pass certificate, export as .p12, then extract:
       openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out pass-cert.pem
       openssl pkcs12 -in Certificates.p12 -nocerts -nodes -out pass-key.pem
  4. Download Apple WWDR G4: https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
       openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem

Environment variables (or pass as CLI args):
  PASS_CERT   path to pass-cert.pem
  PASS_KEY    path to pass-key.pem
  WWDR_CERT   path to wwdr.pem
  TEAM_ID     your 10-character Apple Team ID

Usage:
  python3 scripts/build-wallet-pass.py
  python3 scripts/build-wallet-pass.py --unsigned   # bundle only, for preview
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
WALLET_DIR = ROOT / "wallet"
CONTACT_PATH = WALLET_DIR / "contact.json"
OUTPUT_PATH = ROOT / "Thomas-Gollogly.pkpass"
BUILD_DIR = WALLET_DIR / "build"

ACCENT = (47, 57, 201)
ACCENT_LIGHT = (71, 80, 230)
WHITE = (255, 255, 255)


def load_contact() -> dict:
    with open(CONTACT_PATH, encoding="utf-8") as f:
        return json.load(f)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
  for name in (
      "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "Arial Bold.ttf" if bold else "Arial.ttf",
  ):
      try:
          return ImageFont.truetype(name, size)
      except OSError:
          continue
  return ImageFont.load_default()


def _rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    _rounded_rect(draw, (0, 0, size - 1, size - 1), max(4, size // 7), ACCENT)
    font = _font(max(10, size // 3), bold=True)
    text = "TG"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - bbox[1]), text, fill=WHITE, font=font)
    return img


def make_logo(width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = _font(max(14, height // 2), bold=True)
    text = "Thomas Gollogly"
    draw.text((0, (height - 20) // 2), text, fill=WHITE, font=font)
    return img


def make_strip(width: int, height: int, contact: dict) -> Image.Image:
    img = Image.new("RGB", (width, height), ACCENT)
    draw = ImageDraw.Draw(img)
    # subtle gradient band
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(ACCENT[0] + (ACCENT_LIGHT[0] - ACCENT[0]) * t * 0.35)
        g = int(ACCENT[1] + (ACCENT_LIGHT[1] - ACCENT[1]) * t * 0.35)
        b = int(ACCENT[2] + (ACCENT_LIGHT[2] - ACCENT[2]) * t * 0.35)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    title_font = _font(28, bold=True)
    sub_font = _font(15)
    draw.text((24, 28), contact["name"], fill=WHITE, font=title_font)
    draw.text((24, 68), contact["title"], fill=(238, 240, 254), font=sub_font)
    draw.text((24, 94), contact["tagline"], fill=(220, 224, 252), font=sub_font)
    return img


def vcard_message(contact: dict) -> str:
    vcf_path = ROOT / "Thomas-Gollogly.vcf"
    return vcf_path.read_text(encoding="utf-8").strip().replace("\n", "\\n")


def build_pass_json(contact: dict) -> dict:
    team_id = os.environ.get("TEAM_ID", contact.get("team_id", "REPLACE_WITH_TEAM_ID"))
    return {
        "formatVersion": 1,
        "passTypeIdentifier": contact["pass_type_id"],
        "serialNumber": "thomas-gollogly-v1",
        "teamIdentifier": team_id,
        "organizationName": contact["organization"],
        "description": f"{contact['name']} — Developer Business Card",
        "logoText": contact["name"],
        "foregroundColor": contact["foreground_color"],
        "backgroundColor": contact["background_color"],
        "labelColor": contact["label_color"],
        "generic": {
            "primaryFields": [
                {
                    "key": "name",
                    "label": "DEVELOPER",
                    "value": contact["name"],
                }
            ],
            "secondaryFields": [
                {
                    "key": "role",
                    "label": "ROLE",
                    "value": contact["title"],
                },
                {
                    "key": "location",
                    "label": "LOCATION",
                    "value": contact["location"],
                },
            ],
            "auxiliaryFields": [
                {
                    "key": "email",
                    "label": "EMAIL",
                    "value": contact["email"],
                },
                *(
                    [
                        {
                            "key": "phone",
                            "label": "PHONE",
                            "value": contact["phone_display"],
                        }
                    ]
                    if contact.get("phone_display")
                    else []
                ),
            ],
            "backFields": [
                {
                    "key": "website",
                    "label": "WEBSITE",
                    "value": contact["website"],
                },
                {
                    "key": "github",
                    "label": "GITHUB",
                    "value": contact["github"],
                },
                {
                    "key": "linkedin",
                    "label": "LINKEDIN",
                    "value": contact["linkedin"],
                },
                {
                    "key": "portfolio",
                    "label": "PORTFOLIO",
                    "value": "Eight live web apps — open tgollogly.dev on your phone.",
                },
                {
                    "key": "about",
                    "label": "ABOUT",
                    "value": contact["tagline"] + ". Open to junior, trainee, apprentice or contract developer roles.",
                },
            ],
        },
        "barcodes": [
            {
                "format": "PKBarcodeFormatQR",
                "message": contact["card_url"],
                "messageEncoding": "iso-8859-1",
                "altText": contact["website_label"],
            }
        ],
    }


def write_images(out_dir: Path, contact: dict) -> None:
    for size, name in [(29, "icon.png"), (58, "icon@2x.png"), (87, "icon@3x.png")]:
        make_icon(size).save(out_dir / name)

    make_logo(320, 100).save(out_dir / "logo.png")
    make_logo(640, 100).save(out_dir / "logo@2x.png")
    make_logo(960, 150).save(out_dir / "logo@3x.png")

    make_strip(375, 123, contact).save(out_dir / "strip.png")
    make_strip(750, 246, contact).save(out_dir / "strip@2x.png")
    make_strip(1125, 369, contact).save(out_dir / "strip@3x.png")


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_manifest(out_dir: Path) -> None:
    manifest = {}
    for path in sorted(out_dir.iterdir()):
        if path.name == "manifest.json" or path.name == "signature":
            continue
        manifest[path.name] = sha1_file(path)
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"))


def sign_manifest(out_dir: Path, cert: Path, key: Path, wwdr: Path) -> None:
    manifest = out_dir / "manifest.json"
    signature = out_dir / "signature"
    cmd = [
        "openssl", "smime", "-binary", "-sign",
        "-certfile", str(wwdr),
        "-signer", str(cert),
        "-inkey", str(key),
        "-in", str(manifest),
        "-out", str(signature),
        "-outform", "DER",
        "-md", "sha256",
    ]
    subprocess.run(cmd, check=True)


def zip_pkpass(out_dir: Path, output: Path) -> None:
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(out_dir.iterdir()):
            if path.is_file():
                zf.write(path, arcname=path.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Apple Wallet business card")
    parser.add_argument("--unsigned", action="store_true", help="Skip signing (preview bundle only)")
    parser.add_argument("-o", "--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    contact = load_contact()

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)

    write_images(BUILD_DIR, contact)
    with open(BUILD_DIR / "pass.json", "w", encoding="utf-8") as f:
        json.dump(build_pass_json(contact), f, indent=2)
        f.write("\n")

    build_manifest(BUILD_DIR)

    cert = os.environ.get("PASS_CERT")
    key = os.environ.get("PASS_KEY")
    wwdr = os.environ.get("WWDR_CERT")

    if args.unsigned:
        print("Built unsigned pass bundle at", BUILD_DIR)
        print("iPhone Wallet requires a signed .pkpass — set PASS_CERT, PASS_KEY, WWDR_CERT, TEAM_ID and re-run.")
        zip_pkpass(BUILD_DIR, args.output)
        print("Wrote", args.output, "(unsigned — will not install on iPhone)")
        return 0

    if not all([cert, key, wwdr]):
        print("Missing signing certificates. Building unsigned bundle for preview.")
        print("Set PASS_CERT, PASS_KEY, WWDR_CERT, TEAM_ID then re-run to sign.")
        zip_pkpass(BUILD_DIR, args.output)
        print("Wrote", args.output)
        return 0

    team_id = os.environ.get("TEAM_ID")
    if not team_id or team_id == "REPLACE_WITH_TEAM_ID":
        print("Warning: set TEAM_ID to your Apple Team ID in contact.json or env.", file=sys.stderr)

    sign_manifest(BUILD_DIR, Path(cert), Path(key), Path(wwdr))
    zip_pkpass(BUILD_DIR, args.output)
    print("Signed pass written to", args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
