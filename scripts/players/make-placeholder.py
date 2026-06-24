#!/usr/bin/env python3
"""Generate a LICENSE-CLEAN placeholder craque cutout (a generic footballer
silhouette — no likeness, no third-party art) so the AO VIVO hero can be wired
and demo'd without committing EA Sports / FUTBIN imagery.

Replace the output with a real, license-checked transparent PNG before enabling
PLAYER_CUTOUTS in production. See docs/player-images-spike.md.

Usage: python3 scripts/players/make-placeholder.py public/players/eng/bellingham.png
"""
import sys
import os
from PIL import Image, ImageDraw

W, H, S = 520, 700, 3  # supersample for smooth edges
FILL = (236, 239, 244, 235)


def silhouette(dst: str) -> None:
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def poly(pts):
        d.polygon([(x * S, y * S) for x, y in pts], fill=FILL)

    def ellipse(box):
        d.ellipse([c * S for c in box], fill=FILL)

    ellipse((206, 56, 314, 170))                      # head
    poly([(205, 182), (315, 182), (300, 368), (220, 368)])  # torso
    poly([(208, 188), (234, 198), (188, 344), (158, 334)])  # left arm
    poly([(312, 188), (286, 198), (340, 332), (366, 320)])  # right arm
    poly([(224, 360), (264, 360), (252, 628), (210, 628)])  # left (planted) leg
    poly([(262, 360), (300, 360), (334, 602), (298, 616)])  # right (kicking) leg
    ellipse((322, 588, 378, 644))                     # ball at the right foot

    img = img.resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img.save(dst)
    print(f"wrote {dst} ({os.path.getsize(dst)} bytes, {W}x{H})")


if __name__ == "__main__":
    silhouette(sys.argv[1] if len(sys.argv) > 1 else "public/players/eng/bellingham.png")
