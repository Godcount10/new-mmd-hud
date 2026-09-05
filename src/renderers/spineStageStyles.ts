export const spineStageStyles = String.raw`
[data-hud-mount="nikke-spine-stage"] {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
  color: #f5f0eb;
  font-family: Bahnschrift, "Arial Narrow", "Microsoft YaHei", sans-serif;
}

[data-hud="spine-stage"] {
  --stage-bg: #080808;
  --stage-panel: #12110f;
  --stage-panel-raised: #1a1815;
  --stage-line: #39332d;
  --stage-line-soft: #27231f;
  --stage-orange: #ff7a1a;
  --stage-orange-bright: #ff9b52;
  --stage-orange-pale: #ffd4b2;
  --stage-text: #f5f0eb;
  --stage-muted: #b7ada4;
  --stage-teal: #5ad9c9;
  position: absolute;
  inset: 0;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  color: var(--stage-text);
  background: var(--stage-bg);
  color-scheme: dark;
}

[data-hud="spine-stage"] *,
[data-hud="spine-stage"] *::before,
[data-hud="spine-stage"] *::after {
  box-sizing: border-box;
  letter-spacing: 0;
}

[data-hud="spine-stage"] ::selection {
  color: #080808;
  background: var(--stage-orange-bright);
}

[data-hud="spine-stage"] button,
[data-hud="spine-stage"] input {
  font: inherit;
}

[data-hud="spine-stage"] button {
  color: inherit;
}

[data-hud="spine-stage"] button:focus-visible,
[data-hud="spine-stage"] input:focus-visible {
  outline: 2px solid var(--stage-orange-bright);
  outline-offset: 3px;
}

[data-hud="spine-stage"] .character-gallery {
  position: absolute;
  inset: 0;
  overflow: auto;
  scrollbar-color: var(--stage-orange) #141210;
  scrollbar-width: thin;
  background: var(--stage-bg);
}

[data-hud="spine-stage"] .character-gallery::-webkit-scrollbar {
  width: 9px;
}

[data-hud="spine-stage"] .character-gallery::-webkit-scrollbar-track {
  background: #141210;
}

[data-hud="spine-stage"] .character-gallery::-webkit-scrollbar-thumb {
  border: 2px solid #141210;
  border-radius: 4px;
  background: var(--stage-orange);
}

[data-hud="spine-stage"] .character-gallery__header {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  min-height: 106px;
  padding: 24px clamp(18px, 4vw, 52px) 20px;
  border-bottom: 1px solid var(--stage-line);
  background: rgb(8 8 8 / 94%);
  backdrop-filter: blur(10px);
}

[data-hud="spine-stage"] .character-gallery__header::before {
  content: "";
  position: absolute;
  top: 0;
  left: clamp(18px, 4vw, 52px);
  width: 88px;
  height: 4px;
  background: var(--stage-orange);
}

[data-hud="spine-stage"] .character-gallery__identity {
  min-width: 0;
}

[data-hud="spine-stage"] .character-gallery__identity h1 {
  margin: 0;
  color: var(--stage-text);
  font-size: 32px;
  font-weight: 850;
  line-height: 1.2;
}

[data-hud="spine-stage"] .character-gallery__identity p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 0;
  color: var(--stage-muted);
  font-size: 12px;
}

[data-hud="spine-stage"] .character-gallery__identity p span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--stage-teal);
  box-shadow: 0 2px 8px rgb(90 217 201 / 32%);
}

[data-hud="spine-stage"] .character-gallery__search {
  display: grid;
  gap: 6px;
  width: min(310px, 42vw);
  color: var(--stage-orange-pale);
  font-size: 11px;
  font-weight: 700;
}

[data-hud="spine-stage"] .character-gallery__search input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--stage-line);
  border-radius: 4px;
  padding: 0 12px;
  color: var(--stage-text);
  background: #151310;
  caret-color: var(--stage-orange);
  transition: border-color 160ms ease, background-color 160ms ease;
}

[data-hud="spine-stage"] .character-gallery__search input::placeholder {
  color: #92877d;
}

[data-hud="spine-stage"] .character-gallery__search input:hover,
[data-hud="spine-stage"] .character-gallery__search input:focus {
  border-color: var(--stage-orange);
  background: #1a1612;
}

[data-hud="spine-stage"] .character-gallery__rail {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px clamp(18px, 4vw, 52px);
  color: #958b82;
  font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .character-gallery__rail i {
  flex: 1;
  height: 1px;
  background: var(--stage-line-soft);
}

[data-hud="spine-stage"] .character-gallery__rail span:last-child {
  color: var(--stage-orange-bright);
  font-variant-numeric: tabular-nums;
}

[data-hud="spine-stage"] .character-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: clamp(10px, 1.4vw, 18px);
  padding: 2px clamp(18px, 4vw, 52px) 44px;
}

[data-hud="spine-stage"] .character-card {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  aspect-ratio: 0.72;
  overflow: hidden;
  border: 1px solid var(--stage-line);
  border-radius: 6px;
  padding: 0;
  text-align: left;
  background: var(--stage-panel);
  box-shadow: 0 8px 18px rgb(0 0 0 / 24%);
  cursor: pointer;
  transition: transform 180ms cubic-bezier(.2, .8, .2, 1), border-color 180ms ease, box-shadow 180ms ease;
}

[data-hud="spine-stage"] .character-card::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 28px;
  height: 5px;
  background: var(--stage-orange);
  transform: scaleX(.36);
  transform-origin: right;
  transition: transform 180ms cubic-bezier(.2, .8, .2, 1);
}

[data-hud="spine-stage"] .character-card:hover {
  z-index: 1;
  border-color: var(--stage-orange);
  transform: translateY(-3px);
  box-shadow: 0 14px 28px rgb(0 0 0 / 42%);
}

[data-hud="spine-stage"] .character-card:hover::after,
[data-hud="spine-stage"] .character-card:focus-visible::after {
  transform: scaleX(1);
}

[data-hud="spine-stage"] .character-card__media {
  position: relative;
  display: block;
  min-height: 0;
  overflow: hidden;
  background: #0e0d0c;
}

[data-hud="spine-stage"] .character-card__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center top;
  filter: saturate(.9) contrast(1.04);
  transition: transform 300ms cubic-bezier(.2, .8, .2, 1), filter 220ms ease;
}

[data-hud="spine-stage"] .character-card:hover .character-card__media img {
  transform: scale(1.035);
  filter: saturate(1.08) contrast(1.06);
}

[data-hud="spine-stage"] .character-card__scanline {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--stage-orange);
  opacity: .8;
}

[data-hud="spine-stage"] .character-card__index {
  position: absolute;
  top: 10px;
  left: 10px;
  min-width: 34px;
  padding: 4px 6px;
  border-radius: 3px;
  color: #0b0908;
  background: var(--stage-orange);
  font: 800 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

[data-hud="spine-stage"] .character-card__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 18px;
  color: #61584f;
  text-align: center;
  background: #11100e;
}

[data-hud="spine-stage"] .character-card__placeholder::before,
[data-hud="spine-stage"] .character-card__placeholder::after {
  content: "";
  position: absolute;
  background: #26211d;
}

[data-hud="spine-stage"] .character-card__placeholder::before {
  top: 50%;
  left: 12%;
  width: 76%;
  height: 1px;
}

[data-hud="spine-stage"] .character-card__placeholder::after {
  top: 12%;
  left: 50%;
  width: 1px;
  height: 76%;
}

[data-hud="spine-stage"] .character-card__placeholder strong,
[data-hud="spine-stage"] .character-card__placeholder small {
  position: relative;
  z-index: 1;
  background: #11100e;
}

[data-hud="spine-stage"] .character-card__placeholder strong {
  color: #9a8e83;
  font: 800 20px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .character-card__placeholder small {
  color: #756a61;
  font: 700 8px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .character-card__caption {
  display: flex;
  align-items: start;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  height: 100px;
  padding: 10px;
  background: var(--stage-panel-raised);
}

[data-hud="spine-stage"] .character-card__caption > span:first-child {
  display: grid;
  gap: 4px;
  min-width: 0;
}

[data-hud="spine-stage"] .character-card__caption strong {
  color: var(--stage-text);
  font-size: 13px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

[data-hud="spine-stage"] .character-card__caption small {
  color: var(--stage-muted);
  font: 700 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .character-card__size {
  flex: 0 0 auto;
  color: var(--stage-orange-pale);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

[data-hud="spine-stage"] .character-gallery__empty {
  display: grid;
  place-content: center;
  gap: 8px;
  min-height: 45vh;
  padding: 32px;
  color: var(--stage-muted);
  text-align: center;
}

[data-hud="spine-stage"] .character-gallery__empty strong {
  color: var(--stage-text);
  font-size: 18px;
}

[data-hud="spine-stage"] .character-gallery__empty span {
  font-size: 12px;
}

[data-hud="spine-stage"] .model-dialog-backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(0 0 0 / 76%);
  backdrop-filter: blur(7px);
}

[data-hud="spine-stage"] .model-dialog {
  position: relative;
  width: min(440px, 100%);
  max-height: 100%;
  overflow: auto;
  border: 1px solid #5a4a3e;
  border-radius: 8px;
  background: #171411;
  box-shadow: 0 22px 52px rgb(0 0 0 / 55%);
  animation: model-dialog-enter 260ms cubic-bezier(.16, 1, .3, 1) both;
}

[data-hud="spine-stage"] .model-dialog__signal {
  display: grid;
  grid-template-columns: 1.8fr 1fr .55fr .25fr;
  gap: 5px;
  height: 5px;
}

[data-hud="spine-stage"] .model-dialog__signal span {
  background: var(--stage-orange);
}

[data-hud="spine-stage"] .model-dialog__signal span:nth-child(2) { opacity: .72; }
[data-hud="spine-stage"] .model-dialog__signal span:nth-child(3) { opacity: .48; }
[data-hud="spine-stage"] .model-dialog__signal span:nth-child(4) { opacity: .28; }

[data-hud="spine-stage"] .model-dialog__content {
  padding: 28px 28px 22px;
}

[data-hud="spine-stage"] .model-dialog__code {
  margin: 0 0 18px;
  color: var(--stage-orange-bright);
  font: 750 10px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .model-dialog h2 {
  margin: 0;
  color: var(--stage-text);
  font-size: 22px;
  overflow-wrap: anywhere;
  line-height: 1.15;
}

[data-hud="spine-stage"] .model-dialog__detail {
  margin: 12px 0 0;
  color: var(--stage-muted);
  font-size: 13px;
  line-height: 1.65;
}

[data-hud="spine-stage"] .model-dialog__meter {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 22px;
  padding: 17px 0;
  border-top: 1px solid var(--stage-line);
  border-bottom: 1px solid var(--stage-line);
}

[data-hud="spine-stage"] .model-dialog__meter span {
  color: var(--stage-orange-pale);
  font-size: 12px;
}

[data-hud="spine-stage"] .model-dialog__meter strong {
  color: var(--stage-orange-bright);
  font-size: 24px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

[data-hud="spine-stage"] .model-dialog__note {
  margin: 12px 0 0;
  color: #a99d92;
  font-size: 11px;
  line-height: 1.55;
}

[data-hud="spine-stage"] .model-dialog__actions {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 10px;
  padding: 16px 28px 24px;
  background: #11100e;
}

[data-hud="spine-stage"] .model-dialog__actions button,
[data-hud="spine-stage"] .model-stage__toolbar button {
  min-height: 42px;
  border-radius: 4px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

[data-hud="spine-stage"] .model-dialog__cancel,
[data-hud="spine-stage"] .model-stage__toolbar button {
  border: 1px solid var(--stage-line);
  color: var(--stage-text);
  background: #1b1815;
}

[data-hud="spine-stage"] .model-dialog__cancel:hover,
[data-hud="spine-stage"] .model-stage__toolbar button:hover {
  border-color: #867363;
  background: #25211c;
}

[data-hud="spine-stage"] .model-dialog__confirm {
  border: 1px solid var(--stage-orange-bright);
  color: #120a04;
  background: var(--stage-orange);
}

[data-hud="spine-stage"] .model-dialog__confirm:hover {
  background: var(--stage-orange-bright);
}

@keyframes model-dialog-enter {
  from {
    opacity: 0;
    clip-path: inset(10% 3% 10% 3%);
    transform: translateY(10px) scale(.985);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    clip-path: inset(0);
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

[data-hud="spine-stage"] .model-stage__toolbar {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 74px;
  padding: 14px clamp(14px, 3vw, 30px);
  border-bottom: 1px solid var(--stage-line);
  background: rgb(8 8 8 / 92%);
  backdrop-filter: blur(9px);
}

[data-hud="spine-stage"] .model-stage__toolbar button {
  min-height: 38px;
}

[data-hud="spine-stage"] .model-stage__toolbar div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

[data-hud="spine-stage"] .model-stage__toolbar strong {
  color: var(--stage-text);
  font-size: 15px;
  overflow-wrap: anywhere;
}

[data-hud="spine-stage"] .model-stage__toolbar span {
  color: var(--stage-orange-pale);
  font: 700 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

[data-hud="spine-stage"] .spine-viewport {
  position: relative;
  min-height: 0;
  width: 100%;
  height: auto;
  overflow: hidden;
  background: #0b0a09;
}

[data-hud="spine-stage"] .spine-viewport::before,
[data-hud="spine-stage"] .spine-viewport::after {
  content: "";
  position: absolute;
  z-index: 0;
  pointer-events: none;
}

[data-hud="spine-stage"] .spine-viewport::before {
  right: -12%;
  bottom: -28%;
  width: 62%;
  height: 68%;
  border: 1px solid #312b26;
  transform: skewX(-18deg);
}

[data-hud="spine-stage"] .spine-viewport::after {
  right: 0;
  bottom: 0;
  width: 34%;
  height: 4px;
  background: var(--stage-orange);
}

[data-hud="spine-stage"] .spine-viewport__canvas {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
}

[data-hud="spine-stage"] .spine-viewport__status {
  position: absolute;
  inset: 50% 18px auto;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  overflow-wrap: anywhere;
  align-items: center;
  justify-content: center;
  color: var(--stage-orange-pale);
  font: 700 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
  text-align: center;
  transform: translateY(-50%);
}

[data-hud="spine-stage"] .spine-viewport[data-spine-state="error"] .spine-viewport__status {
  color: #ffad9b;
  line-height: 1.55;
}

[data-hud="spine-stage"] .spine-viewport__spinner {
  width: 14px;
  height: 14px;
  margin-right: 9px;
  border: 2px solid rgb(255 122 26 / 28%);
  border-top-color: var(--stage-orange);
  border-radius: 50%;
  animation: spine-stage-spin .8s linear infinite;
}

@keyframes spine-stage-spin { to { transform: rotate(360deg); } }

[data-hud="spine-stage"] select {
  width: 100%; min-width: 0; max-width: 100%; height: 36px;
  border: 1px solid var(--stage-line); border-radius: 4px;
  padding: 0 8px; color: var(--stage-text); background: #181818; font: inherit;
}
[data-hud="spine-stage"] select:focus-visible { outline: 2px solid var(--stage-orange); outline-offset: 2px; }
[data-hud="spine-stage"] button:disabled { opacity: .4; cursor: default; }
[data-hud="spine-stage"] .icon-button {
  display: inline-grid; place-items: center; flex: 0 0 40px;
  width: 40px; height: 40px; min-height: 40px; padding: 0;
  border: 1px solid var(--stage-line); border-radius: 4px; background: #181818; cursor: pointer;
}
[data-hud="spine-stage"] .icon-button:hover:not(:disabled) { border-color: var(--stage-orange); }
[data-hud="spine-stage"] .gallery-filters {
  display: flex; flex-wrap: wrap; align-items: end; gap: 12px;
  padding: 16px clamp(18px, 4vw, 52px); color: var(--stage-muted); font-size: 12px;
}
[data-hud="spine-stage"] .gallery-filters label { display: grid; gap: 5px; width: 145px; }
[data-hud="spine-stage"] .gallery-filters > span { margin-left: auto; padding-bottom: 10px; }
[data-hud="spine-stage"] .gallery-pagination { display: flex; align-items: end; justify-content: center; gap: 16px; padding: 12px 16px 30px; }
[data-hud="spine-stage"] .gallery-pagination label { display: grid; gap: 4px; font-size: 12px; color: var(--stage-muted); }
[data-hud="spine-stage"] .character-card { aspect-ratio: auto; height: 340px; }
[data-hud="spine-stage"] .character-card__caption small { overflow-wrap: anywhere; line-height: 1.3; }
[data-hud="spine-stage"] .model-stage { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100%; min-width: 0; }
[data-hud="spine-stage"] .model-stage__identity { flex: 1; }
[data-hud="spine-stage"] .model-stage__variant { display: grid; gap: 5px; width: min(340px, 40%); min-width: 0; font-size: 11px; color: var(--stage-muted); }
[data-hud="spine-stage"] .model-dialog__variant { display: grid; gap: 7px; margin-top: 18px; font-size: 12px; color: var(--stage-muted); }
[data-hud="spine-stage"] .model-dialog__code { overflow-wrap: anywhere; }
[data-hud="spine-stage"] .spine-player { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-width: 0; min-height: 0; }
[data-hud="spine-stage"] .spine-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--stage-line); background: #111; }
[data-hud="spine-stage"] .spine-controls label { display: grid; flex: 1; gap: 4px; min-width: 80px; max-width: 220px; font-size: 11px; color: var(--stage-muted); }
[data-hud="spine-stage"] .spine-controls input { width: 100%; height: 36px; margin: 0; accent-color: var(--stage-orange); }
[data-hud="spine-stage"] .spine-viewport__status button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--stage-line); border-radius: 4px; min-height: 40px; padding: 8px 12px; background: #181818; cursor: pointer; }

@media (max-width: 680px) {
  [data-hud="spine-stage"] .character-gallery__header {
    position: relative;
    display: grid;
    gap: 18px;
    padding: 22px 16px 18px;
  }

  [data-hud="spine-stage"] .character-gallery__header::before {
    left: 16px;
  }

  [data-hud="spine-stage"] .character-gallery__identity h1 {
    font-size: 27px;
  }

  [data-hud="spine-stage"] .character-gallery__search {
    width: 100%;
  }

  [data-hud="spine-stage"] .character-gallery__rail {
    padding: 13px 16px;
  }

  [data-hud="spine-stage"] .character-gallery__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 1px 12px 30px;
  }

  [data-hud="spine-stage"] .character-card {
    height: 300px;
  }

  [data-hud="spine-stage"] .character-card__caption {
    align-items: start;
    flex-direction: column;
    min-height: 68px;
  }

  [data-hud="spine-stage"] .character-card__caption strong {
    font-size: 12px;
  }

  [data-hud="spine-stage"] .model-dialog__content {
    padding: 24px 20px 18px;
  }

  [data-hud="spine-stage"] .model-dialog__actions {
    padding: 14px 20px 20px;
  }

  [data-hud="spine-stage"] .model-dialog__meter strong {
    font-size: 21px;
  }

  [data-hud="spine-stage"] .model-stage__toolbar {
    flex-wrap: wrap;
    min-height: 68px;
    padding: 11px 12px;
  }
  [data-hud="spine-stage"] .model-stage__variant { width: 100%; grid-template-columns: auto minmax(0, 1fr); align-items: center; }
  [data-hud="spine-stage"] .spine-controls { gap: 8px; padding: 8px; }
  [data-hud="spine-stage"] .spine-controls label { min-width: 72px; }
  [data-hud="spine-stage"] .spine-controls .spine-controls__zoom { flex: 1 0 calc(100% - 56px); max-width: none; grid-template-columns: auto minmax(0, 1fr); align-items: center; }
  [data-hud="spine-stage"] .gallery-filters { gap: 10px; padding: 14px 12px; }
  [data-hud="spine-stage"] .gallery-filters label { flex: 1; min-width: 120px; }
}

@media (max-width: 370px) {
  [data-hud="spine-stage"] .character-card__caption {
    padding: 8px;
  }

  [data-hud="spine-stage"] .character-card__caption strong {
    font-size: 11px;
  }

  [data-hud="spine-stage"] .character-card__size {
    font-size: 8px;
  }

  [data-hud="spine-stage"] .model-dialog__meter {
    align-items: start;
    flex-direction: column;
    gap: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-hud="spine-stage"] *,
  [data-hud="spine-stage"] *::before,
  [data-hud="spine-stage"] *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`
