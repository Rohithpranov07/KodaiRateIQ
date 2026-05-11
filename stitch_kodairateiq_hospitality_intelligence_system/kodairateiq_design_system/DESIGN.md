---
name: KodaiRateIQ Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbec'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5efff'
  surface-container-high: '#dee9fb'
  surface-container-highest: '#d8e3f5'
  on-surface: '#111c29'
  on-surface-variant: '#4d463a'
  inverse-surface: '#26313f'
  inverse-on-surface: '#e9f1ff'
  outline: '#7f7668'
  outline-variant: '#d0c5b5'
  surface-tint: '#735b25'
  primary: '#735b25'
  on-primary: '#ffffff'
  primary-container: '#c6a769'
  on-primary-container: '#513c07'
  inverse-primary: '#e3c282'
  secondary: '#635d58'
  on-secondary: '#ffffff'
  secondary-container: '#e7ded7'
  on-secondary-container: '#68625c'
  tertiary: '#2c694e'
  on-tertiary: '#ffffff'
  tertiary-container: '#7ab898'
  on-tertiary-container: '#014931'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdea0'
  primary-fixed-dim: '#e3c282'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5a430e'
  secondary-fixed: '#eae1da'
  secondary-fixed-dim: '#cec5be'
  on-secondary-fixed: '#1f1b17'
  on-secondary-fixed-variant: '#4b4641'
  tertiary-fixed: '#b1f0ce'
  tertiary-fixed-dim: '#95d4b3'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#0e5138'
  background: '#f8f9ff'
  on-background: '#111c29'
  surface-variant: '#d8e3f5'
typography:
  display-lg:
    fontFamily: Satoshi
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Satoshi
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Satoshi
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.08em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max-width: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
---

## Brand & Style

This design system embodies **Modern Luxury Claymorphism**. It is a departure from the cold sterility of traditional enterprise SaaS, opting instead for a tactile, "molded" aesthetic that feels bespoke and institutional. The visual language is defined by soft volume and physical depth—not through aggressive neumorphic extrusions, but through subtle, elegant surface layering that mimics high-end interior architecture and premium stationery.

The target audience consists of hospitality executives and revenue directors who require high-density data presented with calm authority. The emotional response is one of **unshakable stability, exclusivity, and precision**. By utilizing a "Warm-on-Warm" layering technique, the UI avoids harsh contrasts, resulting in a workspace that reduces cognitive load during high-stakes financial decision-making.

## Colors

The palette is rooted in a monochromatic range of luxury neutrals, punctuated by a metallic gold accent. 

*   **Foundation:** We use `Luxury Warm White` as the canvas. Depth is created by "digging" into the surface with `Soft Ivory` or "molding" upward with `Champagne Beige`. 
*   **Accents:** `Luxury Metallic Gold` is reserved for primary actions and highlights of success. It should be used sparingly to maintain its premium feel.
*   **Semantic Colors:** Traditional bright greens and reds are replaced with `Executive Emerald` and `Muted Burgundy`. These tones provide the necessary status signaling while remaining within the sophisticated, desaturated palette of the brand.

## Typography

The typographic hierarchy balances the modern geometric character of **Satoshi** for headlines with the functional clarity of **Inter** for data-heavy interfaces.

*   **Numerical Styling:** For pricing intelligence, all numerical data must use `tabular-nums` (tnum) to ensure vertical alignment in tables.
*   **Restraint:** Avoid using more than three weights. Influence is created through size and the generous use of whitespace rather than heavy font weights.
*   **Caps:** Small caps with tracking (letter-spacing) are used for category headers to evoke an institutional, editorial feel.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. The main content area respects a 1440px max-width to maintain readability for executive summaries, while sidebars and utility panels are fluid.

*   **Grid:** A 12-column system is used for dashboard layouts. 
*   **Rhythm:** An 8px linear scale governs all padding and margins. In this design system, "breathing room" is a luxury; avoid crowding elements.
*   **Adaptation:** On mobile, complex tables reflow into "Molded Cards" that utilize the `Elevated Clay Surface` to maintain the tactile metaphor.

## Elevation & Depth

This design system utilizes **Tonal Claymorphism**. Depth is not created by light hitting a flat surface, but by the physical shaping of the background itself.

1.  **Level 0 (Base):** `Primary Background`. Perfectly flat.
2.  **Level 1 (InsetLayouts):** `Secondary Background` with an inner shadow (`1px 1px 2px rgba(0,0,0,0.05)`) to create a "molded-in" look for data containers.
3.  **Level 2 (Molded Panels):** `Panel Surface` with a very soft, large-spread ambient shadow (`0 12px 24px -8px rgba(64, 59, 54, 0.08)`).
4.  **Level 3 (Floating Components):** `Elevated Clay Surface` with a dual shadow—one for proximity and one for soft ambient occlusion.

Edges should never be pure black; shadows must always be tinted with the `Secondary Text` (Graphite Grey) color to maintain the warmth of the palette.

## Shapes

The shape language is consistently **Rounded**. Sharp 0px corners are forbidden as they break the "soft clay" metaphor.

*   **Standard Radius:** 8px (`rounded`).
*   **Large Containers:** 16px (`rounded-lg`) for main dashboard panels.
*   **Interactive Elements:** Buttons and tags use a higher radius (12px to 24px) to feel more "touchable" and ergonomic.

## Components

### Buttons
Primary buttons use the `Primary Accent` (Gold) with white or `Matte Executive Black` text. They should feature a subtle top-light highlight (1px white inner border at 20% opacity) to enhance the molded look. Secondary buttons use the `Elevated Clay Surface` with no border.

### Cards & Panels
Cards do not use traditional borders. Instead, they are defined by their color shifts (`Panel Surface`) and soft ambient shadows. The header of a card should be separated by a subtle 1px "etched" line using the `Elevated Clay` color.

### Input Fields
Inputs should appear "recessed" into the UI. Use the `Secondary Background` with a subtle inner shadow. On focus, the border transitions to a 1px solid `Primary Accent` (Gold).

### Analytics Widgets
Use `Steel Grey` for neutral trend lines. Positive growth is signaled by `Executive Emerald` and negative by `Muted Burgundy`. All charts should use a stroke width of 2px or higher to maintain the "physical" feel of the interface.

### Chips & Tags
Tags are pill-shaped with a 0.5px border of a darker shade of their own background color, ensuring they look like embossed labels rather than flat UI elements.