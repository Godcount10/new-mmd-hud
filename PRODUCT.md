# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vue 3 + TypeScript + Vite, matching the existing MMD HUD development workflow.

## Users

The primary user is a developer authoring MMD role-card HTML, CSS, regular-expression replacements, and SDK scripts. They need to see changes immediately without uploading a card to the online MMD site.

## Product Purpose

HOST is a local development preview for the newer MMD role-card runtime. It simulates the chat page, message lifecycle, stage, input, and public SDK contract so card code can be edited and observed with Vite hot reload.

## Positioning

The preview prioritizes interface and lifecycle compatibility over pixel-perfect reproduction of MMD's native visual styling.

## Operating Context

The developer runs one local Vite server, edits card source files under `src/card`, and uses the preview controls to simulate user input, AI streaming, theme changes, conversation switches, stage visibility, and message virtualization.

## Capabilities and Constraints

- The simulated page exposes the documented `data-chat` and `data-slot` DOM contract.
- Card styles and scripts run inside an isolated preview iframe.
- The preview provides the documented `sdk` namespaces and lifecycle events.
- The local runtime is synthetic; it does not perform real MMD authentication, network AI calls, or production persistence.
- Card source HMR must preserve the preview shell while rebuilding card HTML, styles, and subscriptions.

## Product Principles

- Interface compatibility before native visual fidelity.
- The simulator must expose the real lifecycle edges that cause card bugs.
- Card code is the source of truth during local development.
- Failures remain visible in the development console and do not blank the preview.
