---
name: HOST Renderer HUDs
description: Observed orange-and-black model HUD variants, scoped to Live2D and Spine renderers.
colors:
  live2d-bg: "#08090b"
  live2d-panel: "#151619"
  live2d-line: "#383b40"
  live2d-text: "#f1f3f5"
  live2d-muted: "#b2b8c1"
  live2d-orange: "#ff8b35"
  live2d-teal: "#69d5c7"
  live2d-field: "#1c1e22"
  live2d-command: "#202226"
  live2d-primary-text: "#15100b"
  live2d-primary-hover: "#ffa665"
  spine-bg: "#080808"
  spine-panel: "#12110f"
  spine-panel-raised: "#1a1815"
  spine-line: "#39332d"
  spine-line-soft: "#27231f"
  spine-orange: "#ff7a1a"
  spine-orange-bright: "#ff9b52"
  spine-orange-pale: "#ffd4b2"
  spine-text: "#f5f0eb"
  spine-muted: "#b7ada4"
  spine-teal: "#5ad9c9"
typography:
  live2d-title:
    fontFamily: "Bahnschrift, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "0"
  live2d-body:
    fontFamily: "Bahnschrift, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
    letterSpacing: "0"
  live2d-label:
    fontFamily: "Bahnschrift, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
    letterSpacing: "0"
  live2d-command:
    fontFamily: "Bahnschrift, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0"
  spine-title:
    fontFamily: "Bahnschrift, Arial Narrow, Microsoft YaHei, sans-serif"
    fontSize: "32px"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  control: "4px"
  live2d-dialog: "6px"
  spine-card: "6px"
  spine-dialog: "8px"
spacing:
  control-gap: "8px"
  compact-gap: "10px"
  group-gap: "12px"
  section-gap: "16px"
  live2d-desktop-inset: "24px"
components:
  live2d-button-primary:
    backgroundColor: "{colors.live2d-orange}"
    textColor: "{colors.live2d-primary-text}"
    typography: "{typography.live2d-command}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  live2d-button-primary-hover:
    backgroundColor: "{colors.live2d-primary-hover}"
  live2d-button-secondary:
    backgroundColor: "{colors.live2d-command}"
    textColor: "{colors.live2d-text}"
    typography: "{typography.live2d-command}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  live2d-icon-button:
    backgroundColor: "{colors.live2d-field}"
    textColor: "{colors.live2d-text}"
    rounded: "{rounded.control}"
    width: "40px"
    height: "40px"
    padding: "0"
  live2d-field:
    backgroundColor: "{colors.live2d-field}"
    textColor: "{colors.live2d-muted}"
    typography: "{typography.live2d-label}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 10px"
---

# Design System: HOST Renderer HUDs

## Overview

This records the existing orange-and-black HUD direction for the Live2D stage and its incumbent Spine counterpart. It is an implementation record for these renderers, not a new identity for the HOST preview shell or other cards. No new creative metaphor was established.

Live2D uses compact selection and playback bands around an unframed canvas. Orange marks actions and transfer estimates, pale text carries model identity, and teal carries runtime status. The Spine renderer uses a warmer neutral variant and also includes a character gallery.

**Key Characteristics:**

- Renderer-scoped color variants within the confirmed orange-and-black direction.
- Compact, labeled controls and icon tools surrounding the model surface.
- Explicit model loading consent with a visible transfer estimate.

Sources: `src/renderers/live2d/styles.css`, `src/renderers/live2d/Live2DStageApp.vue`, and `src/renderers/spineStageStyles.ts`. Live2D review captures: `.impeccable/review/desktop-injection.png` (1440 x 900) and `.impeccable/review/mobile-injection.png` (390 x 844).

## Colors

### Primary

Live2D orange belongs to load actions, focus outlines, numeric transfer estimates, and loading indicators. Spine orange has its own brighter and pale variants for its gallery and consent components. The prefixed tokens are specific to their renderer; they do not replace one another.

### Secondary

Each renderer's teal marks status. It is a secondary signal, not a second primary command color.

### Neutral

Live2D uses cool near-black and charcoal surfaces with pale text and muted labels. Spine uses warmer black, brown-gray lines, and warm pale text. Both separate functional regions with thin borders and tonal changes.

## Typography

Bahnschrift with Microsoft YaHei fallback is the Live2D interface stack. Spine additionally includes Arial Narrow. The recorded roles are interface titles, body text, commands, and labels; neither variant establishes a large display-type system.

Live2D's title reduces to 20px at its mobile breakpoint. Status headings use 20px, consent headings 21px, and transfer values use tabular numerals. Spine's gallery title reduces to 27px on mobile; its compact identifiers and numerical metadata also use a monospace stack. Letter spacing is zero throughout both HUD scopes.

## Layout

Live2D fills its mount with four grid rows: header, model selection, a flexible canvas viewport, and playback controls. The canvas occupies all of its viewport and is not wrapped in a decorative card. Model selection stays visible while the active model plays.

At 680px and below, Live2D selection becomes two equal columns and playback controls wrap. Horizontal band padding reduces to 12px. Controls retain their dimensions while the middle grid row can shrink. Long identity and status text can wrap. The consent dialog is constrained to the viewport and scrolls internally when needed.

Spine shares the 680px breakpoint, but its gallery has its own responsive grid and additional 370px adjustments. Those gallery rules do not apply to the Live2D workspace.

## Elevation & Depth

Live2D uses flat tonal bands and borders without box shadows. Its consent backdrop dims the stage with translucent black. Spine separately uses blurred overlays and soft shadows for gallery cards and its dialog. Spine's depth treatment is not a default for Live2D.

## Shapes

Controls have small rounded corners; icon tools keep a square footprint. Dialog and Spine card radii are variant-specific in the frontmatter. Circles are limited to observed status dots and loading indicators. The canvas itself has no rounded frame.

## Components

### Buttons

Live2D primary and secondary commands combine concise labels with Lucide icons where applicable. Playback, replay, reset, unload, and close controls use Lucide icons with accessible names and hover titles. Icon buttons remain 40px square; command buttons have a 40px minimum height. Orange borders identify hover, a two-pixel orange outline identifies keyboard focus, and disabled controls use reduced opacity.

### Inputs / Fields

Search and model or motion selectors use dark fields, thin borders, compact labels, and stable height. The zoom range uses the primary accent. Model options retain the source catalog identifiers; the HUD does not invent localized identities.

### Model Consent

Live2D shows the selected model and estimated transfer in MiB before initiating a load. The dialog provides cancel and continue commands, focuses cancel first, contains keyboard focus, supports Escape, and makes the underlying workspace inert. This is a modal interaction, not a persistent canvas overlay.

### Runtime States

Empty, loading, and error states occupy the canvas area until a model is ready. Loading provides cancellation; errors provide retry. Ready state leaves the canvas unobstructed except for the small runtime status line. Reduced-motion preference stops the Live2D loading spinner.

## Do's and Don'ts

- Do keep each renderer's prefixed palette and component variants scoped to that renderer.
- Do preserve the full canvas region and stable control dimensions when changing the Live2D toolbar.
- Do retain explicit loading consent, transfer estimates, accessible icon names, and visible keyboard focus.
- Don't apply this renderer record as a replacement identity for the HOST preview shell.
- Don't present model file identifiers as invented character names.
