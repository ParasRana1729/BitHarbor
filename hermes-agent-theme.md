# Hermes Agent — Theme Characteristics
Source: https://hermes-agent.nousresearch.com/
Date: 2026-10-08

## 1. One-line character
Bold Cobalt-brutalist, open-source docs aesthetic: flat ultramarine `#0000f2` field, off-white type, uppercase condensed grotesk display + tiny mono labels, with neon-lime accent and film-grain noise.

## 2. Color system

Core (from inline `<style>`, `theme-color`, CSS vars):
- `--hermes-primary / --hermes-color-blue`: `#0000f2` — page bg, `html`, `body`, `theme-color` (light+dark)
- `--hermes-white / --hermes-color-white`: `#f2f2f2` (body) / `#f5f5f5` (`--hermes-web` fg) — primary text
- `--hw-teams-ink`: `#000091` — text on light sections
- `--hermes-paper / --hw-paper`: `#fff` / `#fdfdfd` — Features + Portal sections (`landing-features`, `landing-portal` are paper bg, ink text; hero/downloads are blue bg, white text)
- `--hw-accent / --color-hermes-accent`: `#edff45` — selection bg, arc highlight, focus glow
- `::selection`: `background: var(--hw-accent); color: var(--hw-bg)`

Extended palette (`--hermes-color-*`):
`blue #0000f2`, `white #f2f2f2`, `yellow #f2f200`, `cyan #00f2f2`, `green #00f279`, `indigo #7900f2`, `magenta #f200f2`, `neon #79f200`, `neutral #616191`, `orange #f27900`, `pink #f20079`, `red #f20000`

Tones / layers (all `color-mix(in srgb, ...)`):
- `blue-dark-*: base + black`: e.g. `--hermes-blue-dark-40` (terminal bg), `-80` (surface-dark), `-98` to `-2`
- `blue-light-*: base + white`: `-10` to `-98`
- `white-dark-*: white + black`: e.g. `#eceaf5` (`grey-100`), dividers
- `layer-light: #fff`, `layer-dark: #000` at `2/5/10/20/40/60/80/90/98%` opacity — cards, hairlines (`20%` hairline), pressed states
- Darkened teams page: `color-mix(in srgb, #0000f2 80%, #000)`

## 3. Typography

Loaded fonts (`<link rel=preload>`):
- `Sigurd_Variable` (serif display, legacy hero) — fallback `Times New Roman, serif`
- `RulesVariable.woff2` — `--font-body: "Rules Variable", sans-serif`
- `RulesGothicCnd-Light.woff2` — `--font-rules-gothic-cnd`, subtitles
- `RulesGothicCmp-Medium.woff2` — `--font-rules-gothic-cmp`, `--font-display`
- `AeonikFonoProTRIAL-Regular.woff2` — meta/mono labels; also `"Hermes Legacy Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

Usage:
- Display: uppercase, `leading-[0.9]`, `tracking-normal`, `font-medium`, condensed/compressed gothic. Hero `clamp(3.5rem, 17vw, 5.5rem)` → `clamp(3.25rem, 8.2vw, 108px)`; section `clamp(2rem, 3.6vw, 48px)`; footer ghost words `304px`.
- Body: `16px`, hero body `18px`, `Rules Variable`.
- Labels/meta: `11px` meta, `12px` sm, `14px` label, mono, uppercase, `opacity-80 hover:opacity-100`.
- Legacy block: `text-transform: uppercase` everywhere.

## 4. Layout & shape
- Page: `max 1440px`, content col `1080px`, pad-x `max(24px, min(6vw, 80px))`, hero `grid 2col / 1col mobile`, `gap 30px`, `min-height 520px`, section pad `80-180px`.
- Features grid: `3col → 2col → 1col`, `gap 80x40px`; platforms `3col cards` with `padding 60px 10px`.
- Radius: almost zero — brutalist squares; only terminal `6px`, inner tabs `4px`, buttons `~4-6px`, scrollbar thumb `1rem`.
- Borders/hairlines: `1-2px` `20%` white/primary mixes; fixed frame `calc(2.5 * var(--vsq))` solid blue.
- Depth: no shadows; depth via `mix-blend-mode: lighten/screen` art (`631x793px` hero, `1121px` platform winged figure, `461-740px` feature plates), parallax `translate3d + scale(1.22)`, animated conic `hw-arc` gradient border (fg → accent → bg).

## 5. Art system & visual imagery

The Hermes art system is defined by a distinct synthesis: **Classical Antiquity & Renaissance Copperplate Engraving fused with 1980s Retro-Computing, CRT Telemetry, and Cyber-Brutalist Minimalism**.

### 5.1 Aesthetic pillars
- **Classical Renaissance & Baroque Engravings**: Woodcut prints, copperplate etchings, stipple hatching, and chiaroscuro lithography featuring classical Greco-Roman mythology, anatomical studies, and allegorical figures.
- **Retro-Digital & Scientific Telemetry**: Horizontal CRT phosphor scanlines, 1-bit bitmap halftone / Bayer dithering, coordinate axes, pixel calibration strips (rainbow test bars), and floating retro GUI viewport windows.
- **Pure Black Grounds (`#000000`) for Color Blending**: All dark art is authored on solid `#000000` black grounds rather than transparent PNGs, relying on browser blending (`mix-blend-mode: lighten`) to burn through the flat cobalt `#0000f2` background with zero edge fringing.
- **Fractal Noise Texture Overlay**: Organic film-grain noise applied via SVG `<feTurbulence>` filter over visual plates.

---

### 5.2 Art catalog & layout roles

| Section | Asset | Dimensions | Technique & Subject | Web Blend / Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **Hero** | `hero.webp` | `631 × 793 px` | Classical engraving of multi-armed winged deity (Hermes / Apollo) with Petasos helmet and sun-ray crown, holding radiating light bundles amid a cosmic halo square on pure black. | `mix-blend-mode: lighten`<br>Centered in hero grid, scroll parallax lag (`--hw-hero-lag: 1`), exit fade + blur. |
| **Platforms (Mac / Win / Linux)** | `platform-art.webp` | `1121 × 1121 px` | Chiaroscuro stippled lithograph of an ascending winged celestial messenger (Hermes / Angel) soaring through stippled clouds on dark ground. | `mix-blend-mode: screen`<br>`opacity: 0.4`<br>Single asset panned across cards via offset: Mac (`+347px`), Windows (`+0.33px`), Linux (`-346.33px`). |
| **Feature #1: Connect** | `feature-connect.webp` | `462 × 407 px` | Radiate-crowned face gazing at a celestial sphere, rendered with horizontal CRT scanlines, graph coordinate axes, and spectral rainbow calibration bar. | Container `height: 320px`, `rounded-t-md`, `bg-hermes`<br>`mix-blend-mode: plus-lighter` noise overlay<br>Parallax `scale(1.22)` with drift bounds (`-48px` to `+32px`). |
| **Feature #2: Remember** | `feature-memory.webp` | `502 × 627 px` | Classical marble bust portrait with dense horizontal interlaced raster lines (thermal / CRT phosphor scan). | Same feature plate container + noise overlay. |
| **Feature #3: Schedule** | `feature-automation.webp` | `564 × 494 px` | Michelangelo *Creation of Adam* homage: human finger touching robotic/bionic prosthetic joint finger with electrical spark discharge, framed with classical serif "HERMES" wordmark. | Same feature plate container + noise overlay. |
| **Feature #4: Delegate** | `feature-delegate.webp` | `567 × 567 px` | Classical figure tumbling into a warped optical checkerboard / op-art vortex tunnel (Fall of Icarus allegory), framed by 1-bit pixel checkerboard borders. | Same feature plate container + noise overlay. |
| **Feature #5: Search** | `feature-search.webp` | `740 × 618 px` | Renaissance knight in ornate embossed plate armor with feathered crest, rendered in cobalt monochrome risograph print (`#0000f2` on white paper). | Placed on white feature card, ink-matched to primary cobalt. |
| **Feature #6: Sandbox** | `feature-sandbox.webp` | `546 × 695 px` | Allegorical figure ascending mountain stone staircase carrying glowing celestial sphere toward a radiant sunburst arch; astronomical constellation tiles; bottom CRT scanline reflection glitch. | Same feature plate container + noise overlay. |
| **Portal / Cloud** | `portal-art.svg` | `575 × 844 px` | Detailed vector woodcut line art of mascot **Nous Girl** in draped robes wearing over-ear studio headphones, holding a floating moon/globe above palm in solid cobalt `#0000f2`. | Vector SVG on paper background. |
| **Footer** | `footer.webp` | `1310 × 890 aspect` (`70dvh`) | Classical marble bust of Hermes in winged Petasos helmet, flanked by floating retro OS camera windows, dithered eye viewports, and terminal diagnostic glitches on black. | `hw-noise` overlay + bottom fade `linear-gradient(to bottom, transparent, var(--hermes-primary) 86%)`<br>Sticky scroll reveal with ghost typography "Nous Research". |
| **Mascot Badge** | `nous-girl.svg` | `60 × 84 px` | High-contrast 1-bit retro anime heroine badge framed in rounded pill with bold serif "NOUS" header. | Used as brand mark and avatar. |
| **Wing Mark** | `hermes-wing.svg` | Vector | Classical stipple-engraved Talaria wing feathers. | Rotated `45deg` in pinned header, standalone brand glyph. |
| **Globe Grid** | `globe.svg` | Vector | 8-bit / pixelated grid globe icon in `#0000f2`. | Navigation and telemetry badge. |

---

### 5.3 Web compositing & CSS integration pipeline

1. **Lighten Blending against Cobalt Ground**:
   ```css
   .landing-hero-art {
     mix-blend-mode: lighten; /* Black (#000000) vanishes into #0000f2; white/light grey linework shines through */
     align-self: stretch;
     position: relative;
   }
   ```
2. **Screen Blending on Multi-Column Cards**:
   ```css
   .landing-platform-art {
     mix-blend-mode: screen;
     opacity: 0.4;
     object-fit: cover;
     pointer-events: none;
     width: 1120.77px;
     height: 1120.77px;
     position: absolute;
     top: calc(50% + 390px);
     transform: translate(-50%, -50%);
   }
   /* Horizontal shift across 3-column platform grid */
   .landing-platform--mac .landing-platform-art     { left: calc(50% + 347px); }
   .landing-platform--windows .landing-platform-art { left: calc(50% + 0.33px); }
   .landing-platform--linux .landing-platform-art   { left: calc(50% - 346.33px); }
   ```
3. **Procedural SVG Fractal Noise Overlay (`.hw-noise`)**:
   ```css
   :root {
     --hw-noise-tile: 12.8rem;
     --hw-noise-bg: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 1 1 0 -1.55'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
   }

   .hw-noise {
     isolation: isolate;
     mix-blend-mode: plus-lighter;
   }

   .hw-noise:after {
     content: "";
     background-image: var(--hw-noise-bg);
     background-position: 0 0;
     background-repeat: repeat;
     background-size: var(--hw-noise-tile) var(--hw-noise-tile);
     opacity: 0.9;
     pointer-events: none;
     position: absolute;
     inset: 0;
   }
   ```
4. **Parallax & Drift Dynamics (`.hw-parallax`)**:
   ```css
   .hw-parallax {
     --py-img: 0px;
     transform: translate3d(0, var(--py-img), 0) scale(1.22);
     will-change: transform;
   }
   ```
5. **Seamless Bottom Gradient Dissolve (Footer)**:
   ```css
   .footer-dissolve {
     background: linear-gradient(to bottom, transparent, var(--hermes-primary) 86%);
   }
   ```

---

## 6. Art generation & reproduction instructions

When generating or commissioning new artwork to fit the Hermes aesthetic:

### 6.1 Core prompt formula (Midjourney / Flux / Stable Diffusion)
```text
[Classical subject or allegorical figure], in the style of classical Renaissance copperplate engraving and Albrecht Dürer woodcut etching, intricate stipple hatching, high-contrast monochrome black and white, [retro-tech element: CRT phosphor horizontal scanlines / floating retro OS terminal viewport windows / 1-bit Bayer dither halftone / celestial coordinate graph ticks], solid pure black background #000000, dramatic chiaroscuro lighting, technical archival scientific print, fine detailed linework, no color, no greyscale gradients, crisp vector-like edges --ar 4:5 --style raw
```

### 6.2 Recommended subject pairings
- **Divine / Mythological Messenger**: Winged helmets (Petasos), winged sandals (Talaria), caduceus, multi-armed deities holding fiber-optic or laser-light filaments.
- **Classical Bust + Telemetry**: Antique marble sculptures (Hermes, Apollo, Athena, Marcus Aurelius) overlaid with camera diagnostic boxes, crosshairs, eye crops in floating GUI window chrome.
- **Cybernetic Anatomical Gestures**: Classical drawing of hands with bionic joints, wires, electrical spark discharge at contact point.
- **Cosmic Allegory**: Figures carrying globes or ascending stone monoliths toward radiant sunburst gates, with celestial charts and astrolabe rings.
- **Manga / Anime Synthesis (Nous Style)**: Retro 80s/90s manga heroine in loose draped garments wearing modern studio monitor headphones, rendered strictly in woodcut engraving cross-hatching.

### 6.3 Post-processing recipe (Photoshop / GIMP / ImageMagick / Canvas)
1. **Contrast & Black Ground Crush**:
   - Convert to Grayscale.
   - Adjust Curves/Levels to clamp shadows to absolute `#000000` (RGB 0, 0, 0) and highlights to crisp `#F2F2F2` or `#FFFFFF`.
2. **Scanline / Halftone Injection**:
   - Add a 1px horizontal black/transparent alternating line pattern at 30-50% opacity, or apply ordered 1-bit Bayer dithering for shadow transitions.
3. **Optional Spectrum Strip Accent**:
   - For technical calibration feel, place a 2-4px tall thin rainbow spectrum bar (cyan, green, yellow, orange, red) along one axis or margin frame.
4. **Export Format**:
   - WebP or PNG with lossless compression. Keep the black background intact — do **not** export transparent cutouts if using CSS `mix-blend-mode: lighten`.
5. **For Paper / White Sections**:
   - Invert the art or map black ink directly to `--hermes-primary` (`#0000f2`) on transparent or `#FFFFFF` paper ground.

---

## 7. Texture / motifs
- SVG fractal-noise tile: `feTurbulence baseFrequency 0.72, 4 octaves`, `12.8rem` tile, `hw-noise` overlay on all feature/portal art.
- Thin custom scrollbars `0.25rem`, transparent → `20%` fg on hover.
- Terminal card: dark-blue `var(--hermes-blue-dark-40)`, 3-tab switcher (macOS/Linux/Windows), active tab solid primary, copy button.
- Wing/logo SVG + `nous-girl 60x86px` illustration, globe SVG, oversized ghost typography (`Hermes`, `Nous Research` outlined).
- Pricing chips: `Free $0 / Plus $20 / Super $100 / Ultra $200`, `10% bonus credits`, pill toggles.

## 8. Reuse tokens (CSS)
```css
:root {
  --hermes-primary: #0000f2;
  --hermes-white: #f5f5f5; /* body #f2f2f2 */
  --hermes-ink: #000091;
  --hermes-paper: #fff;
  --hermes-accent: #edff45;
  --hermes-grey-100: #eceaf5;
  --hermes-terminal: var(--hermes-blue-dark-40);
  --font-display: "Rules Gothic Compressed", sans-serif;
  --font-subtitle: "Rules Gothic Condensed", "Rules Variable", sans-serif;
  --font-body: "Rules Variable", sans-serif;
  --font-meta: "Aeonik Fono", ui-monospace, monospace;
}
```

## 9. Vibe in 5 words
Cobalt, flat, uppercase, technical, maximalist-minimal.
