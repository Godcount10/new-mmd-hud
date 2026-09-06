# Brown Dust 2 Resource Publication

The local Spine instance includes NIKKE and Brown Dust 2 as separate game catalogs.
This document covers resource backup/publication, not a change to the player or the
three-instance architecture.

## Repositories

- Source: https://github.com/Godcount10/new-mmd-hud (private).
- Resources: https://github.com/Godcount10/mmd-brown-dust-2-models (public).
- Upstream: `Zormolo/Brown-Dust-2-Assets`, commit `2da10c18b4b1c963949da62591f5d1cabd69cb0b`.
- Release configuration: `brown-dust-release.json`, fixed tag `v1.0.0`.

Published on 2026-09-06 at commit `2f7279ce0838a7e269edfd9e4a8c734f59110b54`.
All 3,729 remote files were verified against their byte counts and Git blob hashes.

The snapshot contains 492 Spine 4.1.11 models and their dependencies, plus the
downloaded skill cutscene backgrounds. Original assets occupy about 3.53 GB;
including the 492 browser packages and metadata the publication is about 4.13 GB.
It contains 3,729 files. The largest file is about 11 MB. No Git LFS is used.

## Resource Layout

```text
assets/                     Original skeletons, atlases, textures and backgrounds
hud-assets/v1/packages/     CSP-compatible skeleton/atlas registration scripts
hud-assets/v1/catalog.json  Catalog with version-pinned CDN URLs
upstream/                  Source README, index and inventory
LICENSE                    Preserved upstream license
manifest.json              Byte sizes, SHA-256 and Git blob hashes
```

The source repository does not include this resource tree. It contains the light
generated catalog, player source, release configuration and maintenance scripts.
The generated publication directory is a separate sibling of HOST:
`../mmd-brown-dust-2-models`.

## Publication

Run these only as the owner of the configured resource repository:

```powershell
npm run prepare:brown-dust-release
npm run publish:brown-dust-release
```

Preparation verifies every original source file against its indexed Git blob hash,
copies only explicitly selected resources, and preserves existing differing files
by failing instead of overwriting them. No source resource is deleted or moved.

The publisher verifies the local SHA-256 hashes, commits and pushes batches smaller
than 240 MiB, and confirms each pushed commit. After all batches it compares every
remote path, byte count and Git blob hash, then pushes the immutable `v1.0.0` tag.
It never force-pushes. An interrupted run can be resumed with the same command;
progress is recorded locally in `reports/brown-dust-publish-progress.json`.

Do not change the files of an existing published version. A new resource snapshot
requires a new version and a reviewed publication target.

## Restoring Local Resources

For a fresh checkout with no existing `../model-resources/brown-dust-2` directory:

```powershell
git clone --depth 1 --branch v1.0.0 https://github.com/Godcount10/mmd-brown-dust-2-models.git ../model-resources/brown-dust-2
Copy-Item ../model-resources/brown-dust-2/upstream/inventory-report.json ../model-resources/brown-dust-2/inventory-report.json
Copy-Item ../model-resources/brown-dust-2/upstream/source-index.json ../model-resources/brown-dust-2/source-index.json
npm run generate:brown-dust-catalog
npm run dev
```

If the local resource directory already exists, preserve it; do not clone over it.
The local preview continues to use `/_brown-model-files/` and
`/_brown-model-release/`, loading model data only after confirmation.

Publication alone does not replace the HUD's catalog registration. The current
local entry includes both games; the existing production entry still registers
NIKKE only. This release provides the online Brown Dust 2 resources and catalog
for a subsequent production-entry update. It does not claim a real MMD/CDN render
test of all 492 models.

The source inventory records texture-size and filename-case warnings. Windows
can hide filename-case differences that matter on case-sensitive CDN paths;
remote-player integration must honor the actual atlas texture filenames.
