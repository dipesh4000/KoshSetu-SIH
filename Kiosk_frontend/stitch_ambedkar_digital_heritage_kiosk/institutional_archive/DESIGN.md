---
name: Institutional Archive
colors:
  surface: '#fdf9ee'
  surface-dim: '#dddacf'
  surface-bright: '#fdf9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3e8'
  surface-container: '#f1eee2'
  surface-container-high: '#ebe8dd'
  surface-container-highest: '#e6e2d7'
  on-surface: '#1c1c15'
  on-surface-variant: '#45464b'
  inverse-surface: '#313129'
  inverse-on-surface: '#f4f1e5'
  outline: '#76777c'
  outline-variant: '#c6c6cc'
  surface-tint: '#5a5e6a'
  primary: '#02050d'
  on-primary: '#ffffff'
  primary-container: '#1a1e28'
  on-primary-container: '#828692'
  inverse-primary: '#c3c6d4'
  secondary: '#615e57'
  on-secondary: '#ffffff'
  secondary-container: '#e7e2d8'
  on-secondary-container: '#67645c'
  tertiary: '#755b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cea72c'
  on-tertiary-container: '#503d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe2f0'
  primary-fixed-dim: '#c3c6d4'
  on-primary-fixed: '#171b25'
  on-primary-fixed-variant: '#434752'
  secondary-fixed: '#e7e2d8'
  secondary-fixed-dim: '#cac6bd'
  on-secondary-fixed: '#1d1c16'
  on-secondary-fixed-variant: '#494740'
  tertiary-fixed: '#ffe08e'
  tertiary-fixed-dim: '#ecc246'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#584400'
  background: '#fdf9ee'
  on-background: '#1c1c15'
  surface-variant: '#e6e2d7'
  verified-green: '#2D5A27'
  ai-assisted-blue: '#2E5077'
  ink-pressed: '#0D0F14'
  parchment-bright: '#FAF9F6'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 84px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
  body-lg:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 36px
  body-md:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 32px
  label-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  touch-min: 64px
  touch-lg: 80px
  margin-kiosk: 64px
  gutter: 32px
  rail-width: 120px
  stack-section: 80px
---

## Brand & Style

The design system is built for a **Digital Heritage Kiosk**, evoking the dignified and authoritative atmosphere of a high-end museum or national archive. The brand personality is scholarly, permanent, and tactile—designed to bridge the gap between physical historical artifacts and digital accessibility.

The design style is a hybrid of **Minimalism** and **Tactile/Skeuomorphism**. It prioritizes a "Material-First" philosophy, where the UI is treated as an architectural installation. By using a palette of Deep Ink, Parchment, and Brass, the system avoids the "disposable" feel of modern apps in favor of a weighted, editorial aesthetic reminiscent of curated gallery broadsheets. Large-scale typography and generous negative space cater to the verticality of portrait-oriented kiosk displays, ensuring the subject matter remains the primary focus.

## Colors

The color palette is grounded in natural materials to create a non-clinical, inviting interface.

- **Primary (Deep Ink)**: Used for core typography, iconography, and structural high-contrast elements. It ensures absolute legibility under various lighting conditions.
- **Surface (Parchment)**: The foundational backdrop. It mimics heavy-stock paper, providing a warm, low-glare surface that feels more organic than pure white.
- **Accent (Heritage Brass)**: Reserved for interactive states, focus rings, and decorative structural accents. It provides a metallic warmth that signifies value.
- **Status Colors**: Clear, desaturated semantic tones are used for metadata labeling (Verified/AI-Assisted) to maintain the "archival" feel without introducing loud, modern neons.

## Typography

This system uses a tiered typographic approach to balance historical weight with kiosk legibility.

- **Editorial Serifs (Source Serif 4)**: Used for all narrative content. This font provides the scholarly weight required for historical context while remaining highly legible in long-form reading on vertical screens.
- **Functional Sans-Serif (Inter)**: Used for UI controls, navigation rail labels, and metadata. This provides a modern, utilitarian counterpoint that ensures touch targets are clearly identified.

Sizes are intentionally oversized to accommodate standing viewers and varied reach distances. All body text should maintain a generous line-height (1.5x) to ensure accessibility.

## Layout & Spacing

The layout follows a **Fixed 12-Column Grid** optimized for portrait vertical kiosks.

- **Navigation Rail**: A persistent 120px vertical rail on the left or right side provides high-level navigation. This ensures the user's hand does not obscure the primary content during interaction.
- **Margins & Gutters**: Large 64px outer margins prevent content from feeling "trapped" by the physical kiosk bezel. 32px gutters provide clear separation for multi-column archival data.
- **Rhythm**: Content is organized in distinct horizontal bands separated by `stack-section` (80px) spacing, creating a "scrolling exhibition" feel.
- **Touch Targets**: A strict 64px minimum touch target height is enforced for all interactive elements to accommodate all ages and motor abilities.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Subtle Outlines** rather than traditional drop shadows, which can look "muddy" on large kiosk displays.

- **Surface Tiers**: The main background uses `Parchment`. Elevated "Artifact Cards" use `Parchment-Bright` with a subtle 1px `Neutral` (Stone) border.
- **Focus States**: Interaction is signaled by "carving" or "extruding" elements. Active buttons use a 2px `Brass` border to feel physically highlighted.
- **Materiality**: Artifacts (Photos/Videos) should appear slightly inset into the cards, using a subtle internal 1px stroke to mimic a physical mounting frame.

## Shapes

The shape language is **Soft (1)**, utilizing a 0.25rem (4px) base radius. 

This creates a "milled" look, where edges feel finished but remain structurally strong, like cut stone or thick museum-grade cardstock. Sharp corners (0px) are used for decorative brass rules and vertical dividers to emphasize the architectural grid of the archive.

## Components

### Artifact Cards
Modular containers designed to hold varied media. They feature a `Parchment-Bright` background and a 1px `Stone` border. The media (photo, video player, or audio waveform) occupies the top 60% of the card, with metadata and "Institutional" labels (Verified/AI-Assisted) positioned at the bottom.

### Navigation Rail
A vertical sidebar containing large icon + label pairs. Active states are indicated by a `Brass` vertical bar on the outer edge and a weight shift in the `Inter` label.

### Action Buttons
Primary buttons use the `Deep Ink` background with `Parchment` text for maximum contrast. The "Heritage Brass" color is used for the `outline` focus state during touch interaction.

### Metadata Chips
Small, rectangular tags with 2px corner radii. They use `Stone` backgrounds for general info and the specific semantic colors for 'Verified' (Green tint) and 'AI-Assisted' (Blue tint) statuses.

### Information Dividers
Vertical and horizontal rules use 1px `Deep Ink` at low opacity (20%) or 2px `Brass` for major section breaks, evoking the lines of a ledger or archival folder.