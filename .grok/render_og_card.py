#!/usr/bin/env python3
"""Designed 2400×1260 share card for THU VÀNG. Staged under .grok, not public/."""

import math

from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2
W, H = 1200 * S, 630 * S

NAVY = (3, 12, 24)
PANEL_HI = (20, 58, 98)
PANEL_LO = (8, 26, 48)
GOLD = (232, 176, 15)
GOLD_DIM = (168, 124, 32)
AMBER = (208, 137, 43)
INK = (231, 238, 246)
SCREEN = (4, 10, 18)

FONT_B = "/workspace/.grok/fonts/BeVietnamPro-Bold.ttf"
FONT_M = "/workspace/.grok/fonts/BeVietnamPro-Medium.ttf"


def sc(n):
    return int(round(n * S))


def rgba(color, alpha):
    return (*color, alpha)


def rounded_mask(size, box, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    return mask


def vertical_gradient(size, top, bottom):
    w, h = size
    col = Image.new("RGB", (1, h))
    px = col.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return col.resize((w, h))


def tracked_width(font, text, tracking):
    if not text:
        return 0.0
    return sum(font.getlength(ch) for ch in text) + tracking * (len(text) - 1)


def draw_tracked(base, text, font, y, fill, tracking):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    x = (base.size[0] - tracked_width(font, text, tracking)) / 2
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking
    return Image.alpha_composite(base, overlay)


def screw(draw, cx, cy, r):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(6, 16, 30), outline=GOLD_DIM, width=max(1, S))
    draw.line((cx - r * 0.55, cy, cx + r * 0.55, cy), fill=GOLD_DIM, width=max(1, S))


def waveform(draw, box, color, amp, phase, width):
    x0, y0, x1, y1 = box
    mid = (y0 + y1) / 2
    pts = []
    steps = 80
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        env = math.sin(math.pi * t) ** 0.9
        y = mid - amp * env * (
            0.64 * math.sin(t * math.pi * 6.0 + phase)
            + 0.26 * math.sin(t * math.pi * 14.0 + phase * 1.6)
            + 0.14 * math.sin(t * math.pi * 2.5)
        )
        pts.append((x, y))
    draw.line(pts, fill=color, width=width, joint="curve")


def horn(draw, box):
    """Solid geometric public-address horn, mouth opening to the right, fitted to box."""
    x0, y0, x1, y1 = box
    cy = (y0 + y1) / 2
    throat_w = (x1 - x0) * 0.16
    throat_h = (y1 - y0) * 0.22
    mouth_h = (y1 - y0) * 0.92
    throat = [
        (x0, cy - throat_h / 2),
        (x0 + throat_w, cy - throat_h / 2),
        (x0 + throat_w, cy + throat_h / 2),
        (x0, cy + throat_h / 2),
    ]
    flare = [
        (x0 + throat_w, cy - throat_h / 2),
        (x1, cy - mouth_h / 2),
        (x1, cy + mouth_h / 2),
        (x0 + throat_w, cy + throat_h / 2),
    ]
    draw.polygon(flare, fill=GOLD)
    draw.polygon(throat, fill=GOLD)
    # Inner slot, so the horn reads as metal rather than a gold wedge.
    slot_x = x0 + throat_w + (x1 - x0) * 0.18
    draw.line((slot_x, cy - mouth_h * 0.22, slot_x, cy + mouth_h * 0.22), fill=NAVY, width=sc(3))
    draw.line((x1 - sc(5), cy - mouth_h * 0.38, x1 - sc(5), cy + mouth_h * 0.38), fill=(*NAVY, 255), width=sc(3))


def needle_meter(draw, cx, cy, r):
    draw.arc((cx - r, cy - r, cx + r, cy + r), start=200, end=340, fill=INK, width=sc(2))
    for i in range(9):
        deg = 200 + i * (140 / 8)
        rad = math.radians(deg)
        c, s = math.cos(rad), math.sin(rad)
        inner = r - sc(8 if i % 2 == 0 else 4)
        draw.line(
            (cx + c * inner, cy + s * inner, cx + c * r, cy + s * r),
            fill=GOLD if i >= 6 else INK,
            width=max(1, S),
        )
    rad = math.radians(294)
    c, s = math.cos(rad), math.sin(rad)
    draw.line((cx, cy, cx + c * (r - sc(10)), cy + s * (r - sc(10))), fill=GOLD, width=sc(2.6))
    draw.ellipse((cx - sc(4.5), cy - sc(4.5), cx + sc(4.5), cy + sc(4.5)), fill=AMBER)


def mica_sticker():
    w, h = sc(228), sc(112)
    sticker = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sticker)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=sc(16), fill=rgba(AMBER, 238))
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).polygon(
        [(0, 0), (w, 0), (w, int(h * 0.42)), (0, int(h * 0.22))],
        fill=(255, 228, 160, 78),
    )
    sticker = Image.alpha_composite(sticker, sheen)
    draw = ImageDraw.Draw(sticker)
    draw.rounded_rectangle(
        (sc(7), sc(7), w - sc(8), h - sc(8)),
        radius=sc(11),
        outline=rgba(GOLD, 220),
        width=max(1, S),
    )
    waveform(draw, (sc(24), sc(26), w - sc(24), sc(58)), rgba(NAVY, 220), sc(11), 0.3, sc(2.4))
    waveform(draw, (sc(24), sc(54), w - sc(24), sc(90)), rgba((255, 236, 190), 235), sc(8), 1.8, sc(2.2))
    return sticker.rotate(-7, resample=Image.BICUBIC, expand=True)


def main():
    im = Image.new("RGBA", (W, H), (*NAVY, 255))

    field = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field)
    for y in range(sc(20), H, sc(26)):
        fd.line((0, y, W, y), fill=rgba((12, 39, 70), 80), width=1)
    im = Image.alpha_composite(im, field)

    chassis = (sc(32), sc(28), W - sc(32), H - sc(28))
    grad = vertical_gradient((W, H), PANEL_HI, PANEL_LO).convert("RGBA")
    mask = rounded_mask((W, H), chassis, sc(22))
    chassis_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    chassis_img.paste(grad, mask=mask)
    im = Image.alpha_composite(im, chassis_img)

    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle(chassis, radius=sc(22), outline=GOLD, width=sc(2))
    inner = (chassis[0] + sc(7), chassis[1] + sc(7), chassis[2] - sc(7), chassis[3] - sc(7))
    draw.rounded_rectangle(inner, radius=sc(16), outline=rgba(GOLD_DIM, 170), width=max(1, S))

    for cx, cy in (
        (sc(58), sc(54)),
        (W - sc(58), sc(54)),
        (sc(58), H - sc(54)),
        (W - sc(58), H - sc(54)),
    ):
        screw(draw, cx, cy, sc(6.5))

    # Outer wells only — graphics fill them. The faceplate between them
    # carries the lockup, so the screens never open into an empty void
    # under the type.
    screen_w = sc(176)
    screens = (
        (sc(52), sc(68), sc(52) + screen_w, sc(562)),
        (W - sc(52) - screen_w, sc(68), W - sc(52), sc(562)),
    )
    for box in screens:
        draw.rounded_rectangle(box, radius=sc(12), fill=SCREEN)
        draw.rounded_rectangle(box, radius=sc(12), outline=rgba(GOLD_DIM, 150), width=max(1, S))
        x0, y0, x1, y1 = box
        for y in range(y0 + sc(16), y1 - sc(12), sc(24)):
            draw.line((x0 + sc(14), y, x1 - sc(14), y), fill=rgba(INK, 26), width=1)

    # Channel lamps, sitting in each well
    draw.rounded_rectangle(
        (screens[0][0] + sc(16), sc(86), screens[0][0] + sc(58), sc(100)),
        radius=sc(3),
        fill=GOLD,
    )
    draw.rounded_rectangle(
        (screens[1][2] - sc(58), sc(86), screens[1][2] - sc(16), sc(100)),
        radius=sc(3),
        fill=AMBER,
    )

    left = screens[0]
    waveform(
        draw,
        (left[0] + sc(16), left[1] + sc(56), left[2] - sc(16), left[3] - sc(48)),
        GOLD,
        int((left[3] - left[1]) * 0.30),
        0.15,
        sc(3.4),
    )

    right = screens[1]
    pad = sc(18)
    rh = right[3] - right[1]
    horn(
        draw,
        (
            right[0] + pad,
            right[1] + sc(48),
            right[2] - pad,
            right[1] + int(rh * 0.46),
        ),
    )
    needle_meter(
        draw,
        (right[0] + right[2]) / 2,
        right[1] + int(rh * 0.74),
        min(sc(70), (right[2] - right[0]) * 0.32),
    )

    # Corner register marks
    arm = sc(14)
    m = sc(14)
    for x, y, sx, sy in (
        (m, m, 1, 1),
        (W - m, m, -1, 1),
        (m, H - m, 1, -1),
        (W - m, H - m, -1, -1),
    ):
        draw.line((x, y, x + arm * sx, y), fill=GOLD, width=sc(2))
        draw.line((x, y, x, y + arm * sy), fill=GOLD, width=sc(2))

    title = "THU VÀNG"
    # ~60% of the frame. One line: VÀNG is longer than THU, so a stack
    # either goes narrow or tracks the short word until the letters detach.
    size = sc(118)
    font = ImageFont.truetype(FONT_B, size)
    natural = tracked_width(font, title, 0)
    target = sc(760)
    gaps = len(title) - 1
    tracking = max(0, int((target - natural) / gaps))
    # Keep tracking tighter than a letter stem so the name stays one word-pair.
    tracking = min(tracking, int(size * 0.08))
    title_w = tracked_width(font, title, tracking)
    bbox = font.getbbox(title)
    title_top = sc(214) - bbox[1]
    im = draw_tracked(im, title, font, title_top, (*GOLD, 255), tracking)

    rule_y = title_top + bbox[3] + sc(16)
    draw = ImageDraw.Draw(im)
    draw.line((W / 2 - sc(28), rule_y, W / 2 + sc(28), rule_y), fill=GOLD, width=sc(2))

    sub = "Sạch · Phóng thanh · Quảng cáo"
    sub_font = ImageFont.truetype(FONT_M, sc(26))
    sub_track = sc(0.8)
    sub_bbox = sub_font.getbbox(sub)
    sub_top = rule_y + sc(16) - sub_bbox[1]
    im = draw_tracked(im, sub, sub_font, sub_top, (*INK, 255), sub_track)

    sticker = mica_sticker()
    sw, sh = sticker.size
    sx = (W - sw) // 2
    sy = int(sub_top + sub_bbox[3] + sc(26))
    # If the sticker would crowd the chassis edge, pull it up — never clip type.
    floor = H - sc(52) - sh
    if sy > floor:
        sy = floor

    alpha = sticker.split()[-1]
    shade = Image.new("RGBA", sticker.size, (0, 0, 0, 255))
    shade.putalpha(alpha.point(lambda a: min(150, int(a * 0.72))))
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shadow.paste(shade, (sx + sc(5), sy + sc(9)), shade)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=sc(7)))
    im = Image.alpha_composite(im, shadow)
    im.alpha_composite(sticker, (sx, sy))

    rgb = im.convert("RGB")
    rgb.save("/workspace/.grok/og-render.png", "PNG")
    print(
        {
            "title_size": size,
            "tracking": tracking,
            "title_w": round(title_w, 1),
            "title_frac": round(title_w / W, 3),
            "title_top": title_top,
            "title_bottom": title_top + bbox[3],
            "sub_top": sub_top,
            "sub_bottom": sub_top + sub_bbox[3],
            "sticker": (sx, sy, sw, sh),
            "sticker_bottom": sy + sh,
            "canvas": (W, H),
        }
    )


if __name__ == "__main__":
    main()
