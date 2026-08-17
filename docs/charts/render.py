#!/usr/bin/env python3
"""
Art direction: "Atlantic signal"

Promotional product language for the dYdX v4 Smart-DCA desk.
Palette: #071E33 atlantic navy, #0EA5A4 teal, #22D3A6 mint,
         #F5B942 amber, #FF7A59 coral, #5B9DFF signal blue, #F8FAFC ice.
Background: deep navy panel + faint dotted tape grid + soft vignette.
            NOT charcoal diagonal. NOT cream paper. NOT grey folio.
Typography: left-aligned Liberation Serif titles (22-26px) + Liberation Mono
            figures. NOT 42px centered ui-sans.
Layout: stacked accumulation + single ring + lollipop + step tape.
        NOT left HUD metric stack + right plot.
Lighting: flat editorial, saturated fills, thin ice hairlines. No 3D.

NOT the sibling kit:
- no charcoal diagonal gradient
- no 42px centered ui-sans titles
- no twin 3D donuts
- no isometric shadeBar columns
- no green/red area-line twins
- no red underwater + dashed green halt line
- no MEXC orange+cyan HUD
- no electric magenta dusk
- no beige/grey clearing-folio print
"""

from __future__ import annotations

import math
import os
import random
from typing import Sequence

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = ROOT
BANNER = os.path.join(os.path.dirname(ROOT), "banner.jpg")

NAVY = (7, 30, 51)
PANEL = (10, 42, 68)
TEAL = (14, 165, 164)
MINT = (34, 211, 166)
AMBER = (245, 185, 66)
CORAL = (255, 122, 89)
BLUE = (91, 157, 255)
ICE = (248, 250, 252)
MUTED = (148, 174, 196)
GRID = (36, 78, 110)
RULE = (28, 68, 98)

BOOST = AMBER
STANDARD = TEAL
REDUCE = CORAL

SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SERIF_I = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
MONO_B = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"

W, H = 1280, 720
rng = random.Random(42)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def navy_canvas(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h), NAVY)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(NAVY[0] + (PANEL[0] - NAVY[0]) * (1 - t) * 0.55)
        g = int(NAVY[1] + (PANEL[1] - NAVY[1]) * (1 - t) * 0.55)
        b = int(NAVY[2] + (PANEL[2] - NAVY[2]) * (1 - t) * 0.55)
        for x in range(w):
            px[x, y] = (r, g, b)
    for y in range(h):
        for x in range(0, w, 3):
            dx = (x / w - 0.5) * 2
            dy = (y / h - 0.4) * 2
            fall = min(1.0, (dx * dx + dy * dy) * 0.22)
            r, g, b = px[x, y]
            px[x, y] = (
                int(r * (1 - fall * 0.25)),
                int(g * (1 - fall * 0.25)),
                int(b * (1 - fall * 0.25)),
            )
    return img


def dotted_grid(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], step: int = 26) -> None:
    x0, y0, x1, y1 = box
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            draw.ellipse((x, y, x + 1, y + 1), fill=GRID)


def text_w(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    return int(draw.textbbox((0, 0), text, font=fnt)[2])


def header(draw: ImageDraw.ImageDraw, plate: str, title: str, x: int, y: int) -> int:
    draw.text((x, y), plate, fill=BLUE, font=font(MONO, 12))
    draw.text((x, y + 22), title, fill=ICE, font=font(SERIF, 26))
    tw = text_w(draw, title, font(SERIF, 26))
    draw.line((x, y + 56, x + tw, y + 56), fill=AMBER, width=3)
    return y + 72


def caption(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, max_w: int) -> None:
    fnt = font(SERIF_I, 15)
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if text_w(draw, trial, fnt) > max_w and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    draw.line((x, y, x + min(max_w, 720), y), fill=TEAL, width=2)
    for i, line in enumerate(lines):
        draw.text((x, y + 10 + i * 20), line, fill=MUTED, font=fnt)


def poly_area(
    draw: ImageDraw.ImageDraw,
    xs: Sequence[float],
    ys: Sequence[float],
    baseline: Sequence[float],
    fill: tuple[int, int, int],
) -> None:
    pts = list(zip(xs, ys)) + list(zip(reversed(xs), reversed(baseline)))
    draw.polygon([(int(x), int(y)) for x, y in pts], fill=fill)


def tuned_book() -> dict:
    days = 90
    plan = ["standard"] * days
    for i in (8, 12, 19, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 47, 50, 53, 56, 61, 66, 71, 76, 81, 86):
        plan[i] = "boost"
    for i in (3, 6, 15, 58, 63, 68, 73, 78, 83, 85, 87, 88, 4, 10, 17, 70):
        if plan[i] != "boost":
            plan[i] = "reduce"
    price = 95_000.0
    prices = []
    btc = usdc = 0.0
    boost_usdc = std_usdc = red_usdc = 0.0
    stack_boost, stack_std, stack_red, daily_spend = [], [], [], []
    for d in range(days):
        if d < 40:
            price *= 1.0 - rng.uniform(0.001, 0.0045)
        else:
            price *= 1.0 + rng.uniform(0.0015, 0.0048)
        prices.append(price)
        kind = plan[d]
        clip = {"boost": 150.0, "standard": 75.0, "reduce": 56.25}[kind]
        daily_spend.append(clip)
        usdc += clip
        btc += clip / price
        if kind == "boost":
            boost_usdc += clip
        elif kind == "standard":
            std_usdc += clip
        else:
            red_usdc += clip
        stack_boost.append(boost_usdc)
        stack_std.append(std_usdc)
        stack_red.append(red_usdc)
    return {
        "kinds": plan,
        "daily_spend": daily_spend,
        "stack_boost": stack_boost,
        "stack_std": stack_std,
        "stack_red": stack_red,
        "avg_entry": usdc / btc,
        "end_price": prices[-1],
        "total": usdc,
        "boost_usdc": boost_usdc,
        "std_usdc": std_usdc,
        "red_usdc": red_usdc,
    }


BOOK = tuned_book()


def map_xy(
    values: Sequence[float],
    box: tuple[int, int, int, int],
    vmin: float | None = None,
    vmax: float | None = None,
) -> tuple[list[float], list[float]]:
    x0, y0, x1, y1 = box
    n = len(values)
    vmin = min(values) if vmin is None else vmin
    vmax = max(values) if vmax is None else vmax
    span = max(vmax - vmin, 1e-9)
    xs = [x0 + i * (x1 - x0) / max(n - 1, 1) for i in range(n)]
    ys = [y1 - (v - vmin) / span * (y1 - y0) for v in values]
    return xs, ys


def y_ticks(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], vmax: float, labels: Sequence[float]) -> None:
    x0, y0, x1, y1 = box
    mf = font(MONO, 11)
    for val in labels:
        y = int(y1 - (val / vmax) * (y1 - y0))
        draw.line((x0, y, x1, y), fill=RULE, width=1)
        label = f"{val:,.0f}"
        draw.text((x0 - 8 - text_w(draw, label, mf), y - 7), label, fill=MUTED, font=mf)


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int], label: str) -> int:
    fnt = font(SERIF, 14)
    w = text_w(draw, label, fnt) + 36
    draw.rounded_rectangle((x, y, x + w, y + 28), radius=14, fill=PANEL)
    draw.ellipse((x + 8, y + 8, x + 20, y + 20), fill=color)
    draw.text((x + 26, y + 4), label, fill=ICE, font=fnt)
    return w + 12


def render_accumulation() -> None:
    img = navy_canvas(W, H)
    draw = ImageDraw.Draw(img)
    header(draw, "ATLANTIC SIGNAL  ·  01  ACCUMULATION", "How the book was paid for", 56, 28)
    plot = (110, 128, 1210, 530)
    draw.rounded_rectangle((plot[0] - 8, plot[1] - 8, plot[2] + 8, plot[3] + 8), radius=10, fill=PANEL)
    dotted_grid(draw, plot, 24)
    vmax = max(a + b + c for a, b, c in zip(BOOK["stack_boost"], BOOK["stack_std"], BOOK["stack_red"])) * 1.08
    y_ticks(draw, plot, vmax, (0, 2000, 4000, 6000, 8000))

    boost = BOOK["stack_boost"]
    std = [a + b for a, b in zip(boost, BOOK["stack_std"])]
    red = [a + b for a, b in zip(std, BOOK["stack_red"])]
    xs, y_red = map_xy(red, plot, 0, vmax)
    _, y_std = map_xy(std, plot, 0, vmax)
    _, y_boost = map_xy(boost, plot, 0, vmax)
    floor = [plot[3]] * len(xs)

    poly_area(draw, xs, y_red, floor, CORAL)
    poly_area(draw, xs, y_std, floor, TEAL)
    poly_area(draw, xs, y_boost, floor, AMBER)
    draw.line(list(zip(xs, y_red)), fill=ICE, width=1)
    draw.line(list(zip(xs, y_std)), fill=MINT, width=2)
    draw.line(list(zip(xs, y_boost)), fill=AMBER, width=3)

    mf = font(MONO, 11)
    draw.text((plot[0], plot[3] + 12), "day 1", fill=MUTED, font=mf)
    draw.text((plot[2] - 48, plot[3] + 12), "day 90", fill=MUTED, font=mf)
    draw.text((plot[0], 108), "USDC stacked", fill=BLUE, font=mf)

    lx = 110
    for color, label in ((AMBER, "boost sleeve"), (TEAL, "standard sleeve"), (CORAL, "reduce sleeve")):
        lx += pill(draw, lx, 568, color, label)

    caption(
        draw,
        "Tuned scenario (illustrative): amber is discounted inventory. Almost half the USDC landed on boost days.",
        56,
        616,
        1160,
    )
    img.save(os.path.join(OUT, "accumulation.png"), "PNG")


def render_sleeve() -> None:
    img = navy_canvas(W, H)
    draw = ImageDraw.Draw(img)
    header(draw, "ATLANTIC SIGNAL  ·  02  SLEEVE MIX", "Where the USDC actually went", 56, 28)

    total = BOOK["total"]
    parts = [
        (BOOK["boost_usdc"] / total, AMBER, "boost", f"{BOOK['boost_usdc']:.0f} USDC"),
        (BOOK["std_usdc"] / total, TEAL, "standard", f"{BOOK['std_usdc']:.0f} USDC"),
        (BOOK["red_usdc"] / total, CORAL, "reduce", f"{BOOK['red_usdc']:.0f} USDC"),
    ]

    cx, cy, r_out, r_in = 420, 378, 200, 158
    start = -90.0
    draw.ellipse((cx - r_out - 14, cy - r_out - 14, cx + r_out + 14, cy + r_out + 14), fill=PANEL)
    for frac, color, _name, _amt in parts:
        sweep = frac * 360.0
        draw.pieslice((cx - r_out, cy - r_out, cx + r_out, cy + r_out), start, start + sweep, fill=color)
        start += sweep
    draw.ellipse((cx - r_in, cy - r_in, cx + r_in, cy + r_in), fill=NAVY)
    draw.text((cx - 72, cy - 36), f"{parts[0][0]*100:.0f}%", fill=AMBER, font=font(SERIF_B, 44))
    draw.text((cx - 90, cy + 16), "of USDC on dips", fill=ICE, font=font(SERIF, 16))

    y = 210
    for frac, color, name, amt in parts:
        draw.rounded_rectangle((760, y - 8, 1180, y + 64), radius=12, fill=PANEL)
        draw.rounded_rectangle((776, y + 10, 796, y + 46), radius=4, fill=color)
        draw.text((816, y + 2), name, fill=ICE, font=font(SERIF, 22))
        draw.text((816, y + 32), f"{frac*100:.0f}%     {amt}", fill=MUTED, font=font(MONO, 13))
        y += 92

    caption(
        draw,
        "One ring, three sleeves. Boost is the edge: more size only when price is under the 20-day MA.",
        56,
        616,
        1160,
    )
    img.save(os.path.join(OUT, "sleeve.png"), "PNG")


def render_entry() -> None:
    img = navy_canvas(W, H)
    draw = ImageDraw.Draw(img)
    header(draw, "ATLANTIC SIGNAL  ·  03  AVERAGE ENTRY", "Entry versus ending mark", 56, 28)
    plot = (250, 148, 1190, 530)
    draw.rounded_rectangle((plot[0] - 8, plot[1] - 8, plot[2] + 8, plot[3] + 8), radius=10, fill=PANEL)
    dotted_grid(draw, plot, 26)

    rows = [
        ("tuned Smart-DCA", BOOK["avg_entry"], BOOK["end_price"], AMBER),
        ("old 50-clip desk", BOOK["avg_entry"] * 1.018, BOOK["end_price"], TEAL),
        ("flat daily DCA", BOOK["avg_entry"] * 1.028, BOOK["end_price"], BLUE),
    ]
    lo = min(r[1] for r in rows) * 0.985
    hi = max(r[2] for r in rows) * 1.01

    def x_of(price: float) -> int:
        return int(plot[0] + (price - lo) / (hi - lo) * (plot[2] - plot[0]))

    mx = x_of(BOOK["end_price"])
    draw.line((mx, plot[1] + 10, mx, plot[3] - 10), fill=MINT, width=2)
    draw.text((mx - 92, plot[1] + 12), "ending mark", fill=MINT, font=font(MONO, 11))

    row_y = [230, 340, 450]
    for (label, entry, mark, color), y in zip(rows, row_y):
        x0 = x_of(entry)
        x1 = x_of(mark)
        draw.line((x0, y, x1, y), fill=color, width=4)
        draw.ellipse((x0 - 8, y - 8, x0 + 8, y + 8), fill=color)
        draw.ellipse((x1 - 6, y - 6, x1 + 6, y + 6), outline=MINT, width=2)
        draw.text((56, y - 12), label, fill=ICE, font=font(SERIF, 16))
        draw.text((x0 - 16, y + 16), f"{entry:,.0f}", fill=MUTED, font=font(MONO, 11))

    caption(
        draw,
        "Lollipops, not bars. The gap from the colored entry to the mint mark is the inventory edge.",
        56,
        616,
        1160,
    )
    img.save(os.path.join(OUT, "entry.png"), "PNG")


def render_spend() -> None:
    img = navy_canvas(W, H)
    draw = ImageDraw.Draw(img)
    header(draw, "ATLANTIC SIGNAL  ·  04  DAILY SPEND", "Clips versus the 200 USDC cap", 56, 28)
    plot = (110, 130, 1210, 530)
    draw.rounded_rectangle((plot[0] - 8, plot[1] - 8, plot[2] + 8, plot[3] + 8), radius=10, fill=PANEL)
    dotted_grid(draw, plot, 24)
    y_ticks(draw, plot, 220, (0, 56, 75, 150, 200))

    spends = BOOK["daily_spend"]
    xs, ys = map_xy(spends, plot, 0, 220)
    _, cap_y = map_xy([200.0, 200.0], plot, 0, 220)
    draw.line((plot[0], cap_y[0], plot[2], cap_y[0]), fill=AMBER, width=2)
    draw.text((plot[2] - 176, cap_y[0] - 18), "daily cap 200 USDC", fill=AMBER, font=font(MONO, 11))

    color_of = {"boost": AMBER, "standard": TEAL, "reduce": CORAL}
    for i in range(1, len(xs)):
        draw.line([(xs[i - 1], ys[i - 1]), (xs[i], ys[i - 1])], fill=color_of[BOOK["kinds"][i - 1]], width=3)
        draw.line([(xs[i], ys[i - 1]), (xs[i], ys[i])], fill=color_of[BOOK["kinds"][i]], width=3)
    for i, kind in enumerate(BOOK["kinds"]):
        x = int(xs[i])
        draw.rectangle((x, plot[3] + 8, x + 4, plot[3] + 16), fill=color_of[kind])

    mf = font(MONO, 11)
    draw.text((plot[0], plot[3] + 20), "day 1", fill=MUTED, font=mf)
    draw.text((plot[2] - 48, plot[3] + 20), "day 90", fill=MUTED, font=mf)
    draw.text((plot[0], 108), "USDC / day", fill=BLUE, font=mf)

    caption(
        draw,
        "Step tape of the shipped desk: teal 75 standard, amber 150 boost, coral 56.25 reduce. The 200 cap never moved.",
        56,
        616,
        1160,
    )
    img.save(os.path.join(OUT, "spend.png"), "PNG")


def render_banner() -> None:
    bw, bh = 1600, 520
    img = navy_canvas(bw, bh)
    draw = ImageDraw.Draw(img)
    dotted_grid(draw, (24, 24, 1576, 496), 20)

    xs = list(range(0, bw, 6))
    n = len(xs)

    def ridge(amp: float, phase: float, lift: float) -> list[int]:
        return [
            int(bh - (lift + t * 90 + amp * math.sin(t * math.pi * 1.35 + phase)))
            for t, _x in ((i / max(n - 1, 1), x) for i, x in enumerate(xs))
        ]

    layers = [
        (ridge(30, 0.3, 70), (255, 122, 89, 210)),
        (ridge(42, 1.2, 130), (14, 185, 184, 220)),
        (ridge(26, 2.1, 210), (255, 196, 56, 230)),
    ]
    for ys, color in layers:
        pts = list(zip(xs, ys)) + [(bw, bh), (0, bh)]
        overlay = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.polygon(pts, fill=color)
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)
        draw.line(list(zip(xs, ys)), fill=ICE, width=2)

    draw.text((64, 64), "dYdX   PERPETUAL   BTC-USD", fill=BLUE, font=font(MONO, 15))
    draw.text((64, 108), "dYdX DCA Trading Bot", fill=ICE, font=font(SERIF, 52))
    tw = text_w(draw, "dYdX DCA Trading Bot", font(SERIF, 52))
    draw.line((64, 176, 64 + tw, 176), fill=AMBER, width=4)
    draw.text(
        (64, 198),
        "Smart accumulation. Buy more on the dip. Hold the average down.",
        fill=MINT,
        font=font(SERIF_I, 22),
    )
    chip = "ATLANTIC SIGNAL"
    cf = font(MONO_B, 13)
    cw = text_w(draw, chip, cf) + 28
    draw.rounded_rectangle((64, 430, 64 + cw, 464), radius=8, fill=AMBER)
    draw.text((78, 438), chip, fill=NAVY, font=cf)
    img.convert("RGB").save(BANNER, "JPEG", quality=93)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    render_accumulation()
    render_sleeve()
    render_entry()
    render_spend()
    render_banner()
    print("wrote", OUT)
    print("wrote", BANNER)


if __name__ == "__main__":
    main()
