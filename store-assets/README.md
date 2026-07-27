# SVIS — store and brand assets

SVIS platform branding uses navy `#06264B`, cyan `#00A6C8`, Songdee red, and the
vehicle-inspection shield artwork supplied for the product.

## Masters (edit these, then re-render)
The SVG masters remain useful for deterministic small-size and store artwork. The
launcher PNGs use the generated, production-polished vehicle artwork in
`assets/svis-visual.png`.

| File | Size | Used for |
|------|------|----------|
| `icon-master.svg` | 1024² | launcher icon, Play icon |
| `mark-master.svg` | 1024² transparent | Android adaptive foreground + splash mark (safe-zone padded) |
| `feature-master.svg` | 1024×500 | Play feature graphic |
| `favicon-master.svg` | 256² | `assets/favicon.png` + `web/public/favicon.svg`/`logo.svg` |

Rendered with headless Chromium (`/opt/pw-browsers/chromium --headless=new --screenshot`).

## Play Console upload (manual)
| Asset | Spec |
|-------|------|
| `play-icon-512.png` | app icon — 512×512, 32-bit PNG |
| `feature-graphic-1024x500.png` | feature graphic — 1024×500, opaque (no alpha) |
| `screenshots/phone/*` | phone — 1080×1920 (8 shots) |
| `screenshots/tablet7/*` | 7-inch tablet — 1200×1920 (8 shots) |
| `screenshots/tablet10/*` | 10-inch tablet — 1600×2560 (8 shots) |

Screenshots are designed mockups (login mirrors the real screen; the rest reference the real
components, `constants/theme.ts`, and the Thai strings in `lib/i18n.ts`). The RN app has no tablet
layout, so tablet shots reuse the phone designs scaled up with margins.

The eight-shot sequence is:

1. Login with SVIS identity and DHL Express selected as the default company
2. Fleet dashboard
3. Daily inspection checklist
4. Failed inspection with defect evidence
5. Issue and repair tracking
6. Inspection history
7. Unit status
8. Preventive maintenance

The login master is `screenshots/source/login-master.html`. Re-render its three device exports with:

```sh
bash scripts/render-store-login-screenshots.sh
```

The seven workflow screens intentionally keep green/red/orange semantic status colors. Their
legacy DHL navigation accent is converted to SVIS cyan without changing failure red by:

```sh
python3 scripts/rebrand-store-screenshot-accents.py
```

## In-app / launcher assets (rendered into place, no config change)
`assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash-icon.png`, `assets/favicon.png`
(paths unchanged in `app.json`); web dashboard `web/public/logo.svg` + `web/public/favicon.svg`.
