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
- Depth: no shadows; depth via `mix-blend-mode: lighten/screen` art (`631x793px` hero, `1120px` platform orbs, `461-739px` feature art), parallax `translate3d + scale(1.22)`, animated conic `hw-arc` gradient border (fg → accent → bg).

## 5. Texture / motifs
- SVG fractal-noise tile: `feTurbulence baseFrequency 0.72, 4 octaves`, `12.8rem` tile, `hw-noise` overlay on all feature/portal art.
- Thin custom scrollbars `0.25rem`, transparent → `20%` fg on hover.
- Terminal card: dark-blue `var(--hermes-blue-dark-40)`, 3-tab switcher (macOS/Linux/Windows), active tab solid primary, copy button.
- Wing/logo SVG + `nous-girl 60x86px` illustration, globe SVG, oversized ghost typography (`Hermes`, `Nous Research` outlined).
- Pricing chips: `Free $0 / Plus $20 / Super $100 / Ultra $200`, `10% bonus credits`, pill toggles.

## 6. Reuse tokens (CSS)
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

## 7. Vibe in 5 words
Cobalt, flat, uppercase, technical, maximalist-minimal.
