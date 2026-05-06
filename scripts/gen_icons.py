"""
Generate premium barbershop icon and splash for Expo app.
- icon.png (1024x1024) — gold scissors + gradient background
- splash-icon.png (512x512) — white version for splash
- android-icon-foreground.png (1024x1024) — adaptive icon foreground
"""

from PIL import Image, ImageDraw, ImageFont
import math, os

ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images")


def draw_scissors(draw, cx, cy, size, color, stroke_width=None):
    """Draw barber scissors as SVG-like path using PIL arcs + lines."""
    s = size
    sw = stroke_width or max(2, s // 18)

    # Pivot point
    px, py = cx, cy

    angle_open = 32  # degrees between blades

    for sign in [-1, 1]:
        angle = math.radians(sign * angle_open / 2)

        # Blade direction
        dx = math.cos(angle)
        dy = math.sin(angle)

        blade_len = s * 0.46
        handle_len = s * 0.38

        # Blade tip
        tip_x = px + dx * blade_len
        tip_y = py - dy * blade_len

        # Handle end
        hx = px - dx * handle_len
        hy = py + dy * handle_len

        # Draw blade
        draw.line([(px, py), (tip_x, tip_y)], fill=color, width=sw)

        # Draw handle loop (oval)
        loop_cx = hx
        loop_cy = hy
        loop_r = s * 0.10
        perp_dx = -dy * sign
        perp_dy = dx * sign
        loop_cx2 = loop_cx + perp_dx * loop_r * 0.7
        loop_cy2 = loop_cy + perp_dy * loop_r * 0.7

        bbox = [loop_cx2 - loop_r, loop_cy2 - loop_r,
                loop_cx2 + loop_r, loop_cy2 + loop_r]
        draw.ellipse(bbox, outline=color, width=sw)

    # Pivot circle
    pr = sw * 1.8
    draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=color)


def make_icon(size=1024, bg_dark=True, for_splash=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if for_splash:
        # White background for splash (app.json backgroundColor is dark)
        # Transparent — expo-splash-screen handles background
        bg_colors = None
    elif bg_dark:
        bg_colors = [(13, 17, 38, 255), (22, 38, 74, 255)]
    else:
        bg_colors = [(255, 255, 255, 255), (240, 245, 255, 255)]

    # Draw rounded rect background
    r = int(size * 0.22)
    if bg_colors:
        for y in range(size):
            t = y / size
            r0, g0, b0, a0 = bg_colors[0]
            r1, g1, b1, a1 = bg_colors[1]
            rc = int(r0 + (r1 - r0) * t)
            gc = int(g0 + (g1 - g0) * t)
            bc = int(b0 + (b1 - b0) * t)
            draw.line([(0, y), (size, y)], fill=(rc, gc, bc, 255))

        # Rounded mask
        mask = Image.new("L", (size, size), 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        img.putalpha(mask)

    # Draw gold accent ring
    ring_r = int(size * 0.38)
    ring_cx, ring_cy = size // 2, size // 2
    gold = (212, 175, 55, 220)
    ring_w = max(3, size // 80)
    draw.ellipse([ring_cx - ring_r, ring_cy - ring_r,
                  ring_cx + ring_r, ring_cy + ring_r],
                 outline=gold, width=ring_w)

    # Scissors color
    scissors_color = (255, 255, 255, 255) if bg_dark or for_splash else (13, 17, 38, 255)
    if for_splash:
        scissors_color = (255, 255, 255, 255)

    scissors_size = int(size * 0.52)
    draw_scissors(draw, ring_cx, ring_cy, scissors_size, scissors_color,
                  stroke_width=max(4, size // 48))

    # "BARBER" text below scissors
    if not for_splash:
        try:
            font = ImageFont.truetype("arial.ttf", size // 11)
        except Exception:
            font = ImageFont.load_default()

        text = "BARBER"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (size - tw) // 2
        ty = ring_cy + ring_r + int(size * 0.03)
        draw.text((tx, ty), text, fill=gold, font=font)

    return img


# --- Generate icon.png (1024x1024) ---
icon = make_icon(1024, bg_dark=True, for_splash=False)
icon.save(os.path.join(ASSETS, "icon.png"))
print("✓ icon.png")

# --- Generate splash-icon.png (512x512) ---
splash = make_icon(512, bg_dark=False, for_splash=True)
# Make background transparent, keep scissors white
splash_out = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
splash_out.paste(splash, (0, 0), splash)
splash_out.save(os.path.join(ASSETS, "splash-icon.png"))
print("✓ splash-icon.png")

# --- Generate android-icon-foreground.png (1024x1024, transparent bg) ---
fg = make_icon(1024, bg_dark=False, for_splash=True)
fg.save(os.path.join(ASSETS, "android-icon-foreground.png"))
print("✓ android-icon-foreground.png")

print("\nAll icons generated successfully!")
