#!/usr/bin/env python3
"""
gen_icon_assets.py — Genera gli asset derivati dall'icona Milo Office.

Sorgente unica: mobile/assets/icon.png (1024x1024, artwork completo con card,
documento e lettering "MILO | PDF GENERATOR").

Output:
  assets/adaptive-icon.png       1024x1024 RGBA — foreground adaptive Android.
                                 SOLO il glifo documento, ridisegnato in modo
                                 vettoriale e contenuto nella safe zone: il
                                 lettering non entra perche' cadrebbe fuori dal
                                 cerchio garantito dai launcher circolari.
  assets/notification-icon.png    192x192 RGBA — silhouette bianca su
                                 trasparente per le notifiche Android (Android
                                 appiattisce l'icona sul canale alpha: un asset
                                 a colori diventerebbe un quadrato bianco).
  assets/splash.png              1242x2436 — artwork completo centrato sul
                                 fondo #0a0b0f, stessa resa dello splash
                                 precedente.
  assets/favicon.png             48x48 — favicon Expo web.
  ../frontend/public/favicon.ico  favicon del sito (16/32/48).
  ../frontend/src/app/favicon.ico idem, servita da Next.js App Router.

Rieseguire dopo ogni cambio di assets/icon.png:
    python3 mobile/scripts/gen_icon_assets.py
poi rigenerare le mipmap Android con `npx expo prebuild --clean` (mai a mano).
"""

from pathlib import Path

from PIL import Image, ImageDraw

# ─── Geometria del glifo, misurata su assets/icon.png a 1024px ───────────────
# Il documento e' l'unico elemento che sopravvive al mascheramento adaptive,
# quindi lo ridisegniamo invece di ritagliarlo: un crop rettangolare porterebbe
# con se' il fondo scuro della card e il glow, che su canvas trasparente
# diventano un riquadro visibile.

DOC = (205, 135, 819, 722)          # rettangolo del documento
DOC_RADIUS = 34
HEADER_BOTTOM = 300                 # fine della fascia viola
LINES = [                           # (x0, y0, x1, y1) delle righe di testo
    (274, 371, 601, 410),
    (274, 464, 564, 502),
    (274, 556, 543, 594),
    (274, 646, 640, 683),
]

COL_DOC_BODY = (26, 26, 34, 255)     # #1a1a22
COL_HEADER_TOP = (169, 107, 255)     # #a96bff
COL_HEADER_BOTTOM = (124, 58, 237)   # #7c3aed
COL_LINE = (82, 80, 91, 255)         # #52505b
COL_DOC_EDGE = (58, 58, 72, 255)     # #3a3a48 — bordo del documento
COL_BG = (10, 11, 15, 255)           # #0a0b0f — sfondo app e splash

# Safe zone adaptive icon: dei 108dp del foreground Android garantisce solo i
# 66dp centrali. Su un canvas 1024 sono 626px, e un launcher circolare vi
# inscrive un cerchio dello stesso diametro: il glifo deve starci in diagonale.
CANVAS = 1024
SAFE_DIAMETER = CANVAS * 66 / 108

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FRONTEND = ROOT.parent / "frontend"

SS = 4  # supersampling: si disegna a 4x e si riduce, per bordi puliti


def draw_glyph(size_px: int) -> Image.Image:
    """Disegna il documento su canvas trasparente quadrato di lato size_px.

    Il glifo e' inscritto nel canvas mantenendo le proporzioni originali.
    """
    gw = DOC[2] - DOC[0]
    gh = DOC[3] - DOC[1]
    scale = size_px * SS / max(gw, gh)
    w, h = round(gw * scale), round(gh * scale)

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def rel(x, y):
        return ((x - DOC[0]) * scale, (y - DOC[1]) * scale)

    # Corpo del documento. Nell'artwork completo la sagoma si stacca grazie
    # alla card e al glow che la circondano; qui il foreground poggia direttamente
    # sul backgroundColor #0a0b0f, quindi il contorno va esplicitato o il
    # documento sparisce e resta a galleggiare solo la fascia viola.
    d.rounded_rectangle(
        [0, 0, w - 1, h - 1],
        radius=DOC_RADIUS * scale,
        fill=COL_DOC_BODY,
        outline=COL_DOC_EDGE,
        width=max(round(3 * scale), 1),
    )

    # Fascia header con gradiente verticale, ritagliata sulla sagoma del
    # documento: gli angoli superiori restano arrotondati come nell'artwork.
    header_h = round((HEADER_BOTTOM - DOC[1]) * scale)
    grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(header_h):
        t = y / max(header_h - 1, 1)
        gd.line(
            [(0, y), (w, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(COL_HEADER_TOP, COL_HEADER_BOTTOM))
            + (255,),
        )
    shape = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shape).rounded_rectangle(
        [0, 0, w - 1, h - 1], radius=DOC_RADIUS * scale, fill=255
    )
    grad.putalpha(Image.composite(grad.getchannel("A"), Image.new("L", (w, h), 0), shape))
    img.alpha_composite(grad)

    # Righe di testo
    for x0, y0, x1, y1 in LINES:
        a, b = rel(x0, y0), rel(x1, y1)
        d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=(b[1] - a[1]) / 2, fill=COL_LINE)

    out = Image.new("RGBA", (size_px * SS, size_px * SS), (0, 0, 0, 0))
    out.paste(img, ((size_px * SS - w) // 2, (size_px * SS - h) // 2), img)
    return out.resize((size_px, size_px), Image.LANCZOS)


def build_adaptive_icon() -> None:
    """Foreground adaptive: glifo inscritto nel cerchio di safe zone."""
    gw, gh = DOC[2] - DOC[0], DOC[3] - DOC[1]
    diagonal = (gw**2 + gh**2) ** 0.5
    # Il lato del quadrato che contiene il glifo, scalato perche' la sua
    # diagonale non superi il cerchio garantito.
    box = round(max(gw, gh) * SAFE_DIAMETER / diagonal)

    glyph = draw_glyph(box)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - box) // 2
    canvas.paste(glyph, (off, off), glyph)
    canvas.save(ASSETS / "adaptive-icon.png")
    print(f"adaptive-icon.png   glifo {box}px in safe zone {SAFE_DIAMETER:.0f}px (diag "
          f"{(box * diagonal / max(gw, gh)):.0f}px)")


def build_notification_icon() -> None:
    """Silhouette bianca su trasparente: Android usa solo il canale alpha."""
    size, ss = 192, SS
    gw, gh = DOC[2] - DOC[0], DOC[3] - DOC[1]
    scale = size * ss * 0.86 / gh          # margine per il padding di sistema
    w, h = round(gw * scale), round(gh * scale)

    white = (255, 255, 255, 255)
    stroke = max(round(26 * scale), 2)

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # Contorno, non sagoma piena: a 24dp nella status bar un rettangolo pieno
    # diventa una macchia bianca, mentre il contorno resta leggibile.
    d.rounded_rectangle([stroke // 2, stroke // 2, w - 1 - stroke // 2, h - 1 - stroke // 2],
                        radius=DOC_RADIUS * scale, outline=white, width=stroke)
    # Fascia header piena, per conservare la lettura "documento" dell'artwork.
    header_h = round((HEADER_BOTTOM - DOC[1]) * scale)
    head = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(head).rounded_rectangle(
        [0, 0, w - 1, h - 1], radius=DOC_RADIUS * scale, fill=white)
    head = head.crop((0, 0, w, header_h))
    layer.alpha_composite(head, (0, 0))
    # Tre righe: la quarta si perde alle densita' basse e sporca il glifo.
    for x0, y0, x1, y1 in LINES[:3]:
        a = ((x0 - DOC[0]) * scale, (y0 - DOC[1]) * scale)
        b = ((x1 - DOC[0]) * scale, (y1 - DOC[1]) * scale)
        d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=(b[1] - a[1]) / 2, fill=white)

    canvas = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    canvas.paste(layer, ((size * ss - w) // 2, (size * ss - h) // 2), layer)
    canvas.resize((size, size), Image.LANCZOS).save(ASSETS / "notification-icon.png")
    print(f"notification-icon.png  {size}x{size} silhouette bianca alpha")


def build_splash() -> None:
    """Splash: artwork completo centrato, stessa resa del file sostituito."""
    icon = Image.open(ASSETS / "icon.png").convert("RGBA")
    canvas = Image.new("RGBA", (1242, 2436), COL_BG)
    logo = icon.resize((510, 510), Image.LANCZOS)   # dimensione dello splash precedente
    canvas.paste(logo, ((1242 - 510) // 2, (2436 - 510) // 2), logo)
    canvas.convert("RGB").save(ASSETS / "splash.png")
    print("splash.png          1242x2436, logo 510px centrato su #0a0b0f")


def build_favicons() -> None:
    icon = Image.open(ASSETS / "icon.png").convert("RGBA")
    icon.resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    print("favicon.png         48x48")

    for target in (FRONTEND / "public" / "favicon.ico", FRONTEND / "src" / "app" / "favicon.ico"):
        if target.parent.exists():
            icon.resize((256, 256), Image.LANCZOS).save(
                target, sizes=[(16, 16), (32, 32), (48, 48)]
            )
            print(f"{target.relative_to(ROOT.parent)}  16/32/48")


if __name__ == "__main__":
    build_adaptive_icon()
    build_notification_icon()
    build_splash()
    build_favicons()
