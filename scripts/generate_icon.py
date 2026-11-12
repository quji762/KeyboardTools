#!/usr/bin/env python3
"""生成 KeyboardTools 应用图标（build/icon.ico、build/icon.png）。

纯离线脚本，依赖 Pillow。运行：python scripts/generate_icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

TOP = (22, 36, 58)
BOTTOM = (8, 13, 22)
ACCENT = (45, 212, 191)
KEY = (94, 234, 212)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    BUILD.mkdir(parents=True, exist_ok=True)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gradient = Image.new("RGBA", (SIZE, SIZE))
    draw = ImageDraw.Draw(gradient)
    for y in range(SIZE):
        draw.line([(0, y), (SIZE, y)], fill=lerp(TOP, BOTTOM, y / (SIZE - 1)) + (255,))

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, SIZE - 1, SIZE - 1], radius=220, fill=255
    )
    canvas.paste(gradient, (0, 0), mask)

    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(
        [40, 40, SIZE - 40, SIZE - 40], radius=190, outline=ACCENT + (70,), width=6
    )

    d.rounded_rectangle(
        [130, 300, SIZE - 130, 726],
        radius=70,
        fill=(13, 23, 38, 255),
        outline=ACCENT + (255,),
        width=14,
    )

    for row in range(3):
        y = 344 + row * 82
        for col in range(6):
            x = 224 + col * 100
            d.rounded_rectangle([x, y, x + 76, y + 56], radius=14, fill=KEY + (238,))

    d.rounded_rectangle([224, 590, 800, 646], radius=16, fill=KEY + (238,))

    for i, radius in enumerate((12, 9, 6)):
        cx = 806 + i * 32
        d.ellipse(
            [cx - radius, 330 - radius, cx + radius, 330 + radius],
            fill=ACCENT + (200 - i * 55,),
        )

    canvas.save(BUILD / "icon.png")
    canvas.resize((256, 256), Image.LANCZOS).save(
        BUILD / "icon.ico",
        format="ICO",
        sizes=[
            (16, 16),
            (24, 24),
            (32, 32),
            (48, 48),
            (64, 64),
            (128, 128),
            (256, 256),
        ],
    )

    print("icon.png:", (BUILD / "icon.png").stat().st_size, "bytes")
    print("icon.ico:", (BUILD / "icon.ico").stat().st_size, "bytes")


if __name__ == "__main__":
    main()
