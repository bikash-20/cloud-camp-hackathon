#!/usr/bin/env python3
"""Generate PWA icons from the NutriVision SVG logo."""
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"
SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 192, 384, 512]


def draw_logo(size: int) -> Image.Image:
    """Draw the NutriVision logo mark at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale factor
    s = size / 512.0

    # Background circle (earth brown)
    draw.ellipse([0, 0, size - 1, size - 1], fill="#77574A")

    # Inner lighter circle
    inner_r = int(240 * s)
    cx, cy = size // 2, size // 2
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill="#8B6B5A",
    )

    # Eye outer ring
    eye_rx, eye_ry = int(120 * s), int(90 * s)
    eye_cy = int(248 * s)
    ring_w = max(2, int(6 * s))
    draw.ellipse(
        [cx - eye_rx, eye_cy - eye_ry, cx + eye_rx, eye_cy + eye_ry],
        outline="#F9F2E4",
        width=ring_w,
    )

    # Iris
    iris_r = int(48 * s)
    iris_cy = eye_cy
    draw.ellipse(
        [cx - iris_r, iris_cy - iris_r, cx + iris_r, iris_cy + iris_r],
        fill="#B8743A",
    )

    # Pupil
    pupil_r = int(22 * s)
    draw.ellipse(
        [cx - pupil_r, iris_cy - pupil_r, cx + pupil_r, iris_cy + pupil_r],
        fill="#2E2522",
    )

    # Pupil highlight
    hl_r = int(8 * s)
    hl_x, hl_y = cx - int(8 * s), iris_cy - int(8 * s)
    draw.ellipse(
        [hl_x - hl_r, hl_y - hl_r, hl_x + hl_r, hl_y + hl_r],
        fill="#F9F2E4",
    )

    # Leaf shape (simple triangle-ish)
    leaf_pts = [
        (int(310 * s), int(170 * s)),
        (int(370 * s), int(120 * s)),
        (int(330 * s), int(190 * s)),
    ]
    draw.polygon(leaf_pts, fill="#7A8C4F")

    # Small leaf
    leaf2_pts = [
        (int(295 * s), int(155 * s)),
        (int(325 * s), int(130 * s)),
        (int(305 * s), int(165 * s)),
    ]
    draw.polygon(leaf2_pts, fill="#7A8C4F")

    return img


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        img = draw_logo(size)
        path = PUBLIC / f"icon-{size}.png"
        img.save(path, "PNG")
        print(f"  ✓ {path.name} ({size}×{size})")

    # Also create apple-touch-icon
    img = draw_logo(180)
    img.save(PUBLIC / "apple-touch-icon.png", "PNG")
    print(f"  ✓ apple-touch-icon.png (180×180)")

    # Favicon
    for size in [16, 32, 48]:
        img = draw_logo(size)
        img.save(PUBLIC / f"favicon-{size}.png", "PNG")
    print(f"  ✓ favicon icons (16, 32, 48)")

    print("\nAll icons generated!")


if __name__ == "__main__":
    main()
