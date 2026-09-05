export const orangeHudStyles = String.raw`
[data-hud="overlay"] {
  --hud-bg: #080807;
  --hud-panel: #11100e;
  --hud-panel-raised: #17130f;
  --hud-line: #3b271a;
  --hud-line-bright: #70401e;
  --hud-orange: #ff7417;
  --hud-amber: #ffb35c;
  --hud-text: #f5eee7;
  --hud-muted: #9a8777;
  --hud-dim: #655548;
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  padding: clamp(14px, 2.2vw, 30px);
  overflow: auto;
  color: var(--hud-text);
  background: var(--hud-bg);
  font-family: "DIN Alternate", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  letter-spacing: 0;
  isolation: isolate;
}

[data-hud="overlay"]::before,
[data-hud="overlay"]::after {
  position: absolute;
  z-index: -1;
  content: "";
  pointer-events: none;
}

[data-hud="overlay"]::before {
  inset: 10px;
  border: 1px solid rgb(255 116 23 / 22%);
  clip-path: polygon(0 0, 20% 0, 20% 1px, 80% 1px, 80% 0, 100% 0, 100% 100%, 80% 100%, 80% calc(100% - 1px), 20% calc(100% - 1px), 20% 100%, 0 100%);
}

[data-hud="overlay"]::after {
  inset: 0;
  opacity: .16;
  background-image: linear-gradient(90deg, transparent 0, transparent calc(50% - 1px), rgb(255 116 23 / 18%) 50%, transparent calc(50% + 1px), transparent 100%);
}

[data-hud="overlay"] button {
  font: inherit;
}

[data-hud="overlay"] button:focus-visible {
  outline: 1px solid var(--hud-amber);
  outline-offset: 3px;
}

.orange-hud__scanline {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: .08;
  background-image: linear-gradient(to bottom, transparent 0, transparent 5px, rgb(255 179 92 / 25%) 6px, transparent 7px);
  background-size: 100% 7px;
  mix-blend-mode: screen;
  animation: orange-hud-scan 8s linear infinite;
}

.orange-hud__topbar,
.orange-hud__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.orange-hud__topbar {
  min-height: 58px;
  padding: 0 0 16px;
  border-bottom: 1px solid var(--hud-line);
}

.orange-hud__brand,
.orange-hud__session,
.orange-hud__footer-status,
.orange-hud__actions,
.orange-hud__main-heading,
.orange-hud__core-panel-header,
.orange-hud__command-heading,
.orange-hud__readout-meta,
.orange-hud__meter-label {
  display: flex;
  align-items: center;
}

.orange-hud__brand { gap: 11px; min-width: 0; }
.orange-hud__brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--hud-orange);
  color: var(--hud-bg);
  background: var(--hud-orange);
  font-size: 17px;
  font-weight: 800;
}
.orange-hud__brand strong {
  display: block;
  color: var(--hud-text);
  font-size: 15px;
  letter-spacing: .08em;
}
.orange-hud__overline {
  display: block;
  margin-bottom: 3px;
  color: var(--hud-orange);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.orange-hud__session {
  gap: 9px;
  color: var(--hud-muted);
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
}
.orange-hud__session-divider,
.orange-hud__footer-separator {
  width: 1px;
  height: 13px;
  background: var(--hud-line-bright);
}
.orange-hud__pulse {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hud-orange);
  box-shadow: 0 0 0 3px rgb(255 116 23 / 15%);
}
.orange-hud__close {
  min-height: 30px;
  padding: 6px 10px;
  border: 1px solid var(--hud-line-bright);
  border-radius: 2px;
  color: var(--hud-amber);
  background: transparent;
  cursor: pointer;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
}
.orange-hud__close:hover { border-color: var(--hud-orange); color: var(--hud-text); background: rgb(255 116 23 / 10%); }

.orange-hud__body {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) minmax(220px, 290px);
  gap: clamp(18px, 3vw, 42px);
  min-height: 0;
  padding: clamp(24px, 4vw, 54px) 0;
}
.orange-hud__rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 18px;
  border-right: 1px solid var(--hud-line);
}
.orange-hud__rail-button {
  min-height: 32px;
  padding: 7px 5px;
  border: 0;
  border-bottom: 1px solid var(--hud-line);
  color: var(--hud-muted);
  background: transparent;
  cursor: pointer;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
  text-align: left;
}
.orange-hud__rail-button:hover,
.orange-hud__rail-button--active { color: var(--hud-orange); border-color: var(--hud-orange); }
.orange-hud__rail-spacer { flex: 1; }
.orange-hud__rail-version { color: var(--hud-dim); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; transform: rotate(-90deg); transform-origin: left bottom; white-space: nowrap; }

.orange-hud__main { min-width: 0; }
.orange-hud__main-heading { justify-content: space-between; gap: 20px; margin-bottom: 18px; }
.orange-hud__main-heading h1 { margin: 0; color: var(--hud-text); font-size: clamp(22px, 3.2vw, 42px); font-weight: 700; line-height: 1; letter-spacing: .015em; }
.orange-hud__phase { min-width: 76px; padding-left: 14px; border-left: 1px solid var(--hud-line-bright); text-align: right; }
.orange-hud__phase span { display: block; color: var(--hud-muted); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .16em; }
.orange-hud__phase strong { display: block; margin-top: 3px; color: var(--hud-orange); font: 14px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }

.orange-hud__core-panel,
.orange-hud__command-panel {
  border: 1px solid var(--hud-line);
  background: rgb(17 16 14 / 92%);
}
.orange-hud__core-panel { position: relative; overflow: hidden; }
.orange-hud__core-panel::before { position: absolute; top: -1px; left: -1px; width: 90px; height: 2px; content: ""; background: var(--hud-orange); }
.orange-hud__core-panel-header,
.orange-hud__command-heading {
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--hud-line);
  color: var(--hud-amber);
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .1em;
}
.orange-hud__code { color: var(--hud-dim); }
.orange-hud__core-grid { display: grid; grid-template-columns: minmax(130px, 35%) minmax(0, 1fr); gap: clamp(18px, 4vw, 48px); align-items: center; padding: clamp(20px, 3vw, 38px); }
.orange-hud__core-orbit { position: relative; display: grid; place-items: center; width: min(100%, 190px); aspect-ratio: 1; margin: auto; border: 1px solid var(--hud-line-bright); border-radius: 50%; color: var(--hud-orange); }
.orange-hud__core-orbit::before,
.orange-hud__core-orbit::after { position: absolute; content: ""; background: var(--hud-orange); }
.orange-hud__core-orbit::before { width: 1px; height: 12px; top: -7px; }
.orange-hud__core-orbit::after { width: 12px; height: 1px; right: -7px; }
.orange-hud__orbit-ring { position: absolute; border: 1px solid var(--hud-line-bright); border-radius: 50%; }
.orange-hud__orbit-ring--outer { inset: 12%; border-style: dashed; animation: orange-hud-rotate 18s linear infinite; }
.orange-hud__orbit-ring--inner { inset: 29%; border-color: rgb(255 116 23 / 70%); }
.orange-hud__orbit-dot { position: absolute; top: 7%; right: 21%; width: 6px; height: 6px; border-radius: 50%; background: var(--hud-orange); box-shadow: 0 0 0 4px rgb(255 116 23 / 12%); }
.orange-hud__core-orbit strong { font: 700 30px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.orange-hud__readout { min-width: 0; }
.orange-hud__readout > strong { display: block; color: var(--hud-text); font-size: clamp(18px, 2vw, 27px); font-weight: 600; line-height: 1.16; }
.orange-hud__readout p { max-width: 52ch; margin: 10px 0 16px; color: var(--hud-muted); line-height: 1.65; }
.orange-hud__readout-meta { flex-wrap: wrap; gap: 14px 22px; color: var(--hud-dim); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .06em; }
.orange-hud__readout-meta span { display: inline-flex; align-items: center; gap: 6px; }
.orange-hud__readout-meta i { width: 4px; height: 4px; background: var(--hud-orange); }
.orange-hud__readout-meta b { color: var(--hud-amber); font-weight: 500; }
.orange-hud__meter-list { display: grid; gap: 15px; padding: 0 clamp(20px, 3vw, 38px) 22px; }
.orange-hud__meter-label { justify-content: space-between; margin-bottom: 6px; color: var(--hud-muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.orange-hud__meter-label strong { color: var(--hud-orange); font-weight: 500; }
.orange-hud__meter { height: 5px; overflow: hidden; background: #261a12; }
.orange-hud__meter span { display: block; width: 100%; height: 100%; background: var(--hud-orange); transform: scaleX(0); transform-origin: left center; transition: transform .35s ease; }
.orange-hud__meter--muted span { background: var(--hud-amber); }

.orange-hud__command-panel { margin-top: 16px; }
.orange-hud__live-label { color: var(--hud-orange); }
.orange-hud__command-line { display: flex; align-items: center; gap: 8px; padding: 10px 14px; color: var(--hud-muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .05em; }
.orange-hud__command-line + .orange-hud__command-line { border-top: 1px solid rgb(59 39 26 / 60%); }
.orange-hud__command-line strong { overflow: hidden; color: var(--hud-amber); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.orange-hud__command-line--dim { color: var(--hud-dim); }
.orange-hud__command-marker { color: var(--hud-orange); font-size: 13px; }

.orange-hud__side { min-width: 0; padding-left: 20px; border-left: 1px solid var(--hud-line); }
.orange-hud__side-heading { display: flex; justify-content: space-between; padding-bottom: 11px; border-bottom: 1px solid var(--hud-line-bright); color: var(--hud-amber); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; }
.orange-hud__side-heading span:last-child { color: var(--hud-orange); }
.orange-hud__spine-panel { margin-bottom: 24px; }
.orange-hud__spine-panel .orange-hud__side-heading { margin-bottom: 10px; }
.orange-hud__spine-note { margin: 8px 0 0; color: var(--hud-dim); font-size: 10px; line-height: 1.45; }
.spine-viewport {
  position: relative;
  min-height: 190px;
  aspect-ratio: 4 / 3;
  max-height: 280px;
  overflow: hidden;
  border: 1px solid rgb(255 116 23 / 38%);
  background:
    linear-gradient(90deg, rgb(255 116 23 / 6%) 1px, transparent 1px),
    linear-gradient(rgb(255 116 23 / 6%) 1px, transparent 1px),
    #0b0a09;
  background-size: 24px 24px;
}
.spine-viewport::before,
.spine-viewport::after {
  position: absolute;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-color: var(--hud-orange);
  content: "";
  pointer-events: none;
}
.spine-viewport::before { top: 7px; left: 7px; border-top: 1px solid; border-left: 1px solid; }
.spine-viewport::after { right: 7px; bottom: 7px; border-right: 1px solid; border-bottom: 1px solid; }
.spine-viewport__canvas { display: block; width: 100%; height: 100%; min-height: 190px; }
.spine-viewport__status {
  position: absolute;
  inset: 50% 18px auto;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--hud-amber);
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  text-align: center;
  transform: translateY(-50%);
}
.spine-viewport[data-spine-state="error"] .spine-viewport__status { color: #ff9b83; line-height: 1.45; }
.spine-viewport__spinner {
  width: 10px;
  height: 10px;
  border: 1px solid rgb(255 116 23 / 35%);
  border-top-color: var(--hud-orange);
  border-radius: 50%;
  animation: spine-spin .8s linear infinite;
}
.spine-viewport__meta {
  position: absolute;
  right: 10px;
  bottom: 9px;
  left: 10px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #9a7258;
  font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .06em;
  pointer-events: none;
  text-transform: uppercase;
}
.orange-hud__mission { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 14px 0; border-bottom: 1px solid var(--hud-line); }
.orange-hud__mission-index { color: var(--hud-dim); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
.orange-hud__mission strong { display: block; overflow: hidden; color: var(--hud-muted); font-size: 11px; font-weight: 650; letter-spacing: .04em; text-overflow: ellipsis; white-space: nowrap; }
.orange-hud__mission div span { display: block; margin-top: 3px; color: var(--hud-dim); font-size: 10px; }
.orange-hud__mission-state { grid-column: 2; color: var(--hud-dim); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; }
.orange-hud__mission--active .orange-hud__mission-index,
.orange-hud__mission--active strong,
.orange-hud__mission--active .orange-hud__mission-state { color: var(--hud-orange); }
.orange-hud__side-note { margin-top: 22px; padding-top: 12px; border-top: 1px solid var(--hud-line); }
.orange-hud__side-note p { margin: 0; color: var(--hud-muted); font-size: 11px; line-height: 1.6; }

.orange-hud__footer { min-height: 47px; padding-top: 14px; border-top: 1px solid var(--hud-line); }
.orange-hud__footer-status { flex-wrap: wrap; gap: 9px; color: var(--hud-muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .06em; }
.orange-hud__footer-status b { color: var(--hud-amber); font-weight: 500; }
.orange-hud__actions { gap: 8px; }
.orange-hud__actions button { min-height: 31px; padding: 6px 11px; border: 1px solid var(--hud-line-bright); border-radius: 2px; color: var(--hud-bg); background: var(--hud-orange); cursor: pointer; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.orange-hud__actions button + button { color: var(--hud-amber); background: transparent; }
.orange-hud__actions button:hover { border-color: var(--hud-amber); color: var(--hud-bg); background: var(--hud-amber); }
.orange-hud__actions button + button:hover { color: var(--hud-bg); }

@keyframes orange-hud-scan { from { transform: translateY(-7px); } to { transform: translateY(7px); } }
@keyframes orange-hud-rotate { to { transform: rotate(360deg); } }
@keyframes spine-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .orange-hud__scanline,
  .orange-hud__orbit-ring--outer { animation: none; }
  .orange-hud__meter span { transition: none; }
}

@media (max-width: 900px) {
  [data-hud="overlay"] { padding: 18px; }
  .orange-hud__body { grid-template-columns: 68px minmax(0, 1fr); gap: 20px; }
  .orange-hud__side { grid-column: 2; padding: 18px 0 0; border-top: 1px solid var(--hud-line); border-left: 0; }
  .orange-hud__mission { grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; }
  .orange-hud__mission-state { grid-column: 3; grid-row: 1; }
}

@media (max-width: 640px) {
  [data-hud="overlay"] { padding: 14px; }
  .orange-hud__topbar { align-items: flex-start; flex-wrap: wrap; }
  .orange-hud__session { order: 3; width: 100%; padding-top: 10px; border-top: 1px solid var(--hud-line); }
  .orange-hud__body { grid-template-columns: 1fr; gap: 17px; padding: 22px 0; }
  .orange-hud__rail { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 0 0 11px; border-right: 0; border-bottom: 1px solid var(--hud-line); }
  .orange-hud__rail-button { text-align: center; }
  .orange-hud__rail-spacer, .orange-hud__rail-version { display: none; }
  .orange-hud__side { grid-column: auto; }
  .orange-hud__core-grid { grid-template-columns: 1fr; gap: 20px; padding: 22px 18px; }
  .orange-hud__core-orbit { width: 145px; }
  .orange-hud__meter-list { padding: 0 18px 18px; }
  .orange-hud__footer { align-items: stretch; flex-direction: column; }
  .orange-hud__actions { display: grid; grid-template-columns: 1fr 1fr; }
  .orange-hud__actions button { width: 100%; }
}
`
