# Elastic photograph viewer

> 最新：用户定位为电脑 Safari 打开/换片卡顿。参见 [Safari 专项实测与修复](portfolio-safari-viewer.md)。以下较早的自动往返与 in-app browser 数据仅作历史记录。

The photo detail page now uses a warm paper canvas with an uncropped photograph, collection name, photo count, caption, navigation, and optional contact sheet/details drawers. The homepage and original portfolio grid were not edited for this change.

## Interaction

- Click the main photo area to advance; the left quarter goes back. Arrow keys, footer buttons, horizontal dragging, and horizontal trackpad gestures are supported.
- Incoming photographs spring into place while the previous photograph slides away. The moving plane rotates and stretches slightly; a short drag springs back.
- At most two photo planes are mounted. Rapid navigation replaces the old departure rather than accumulating animations.
- The contact sheet is opened explicitly and does not resize the main canvas. Keyboard photo navigation is suspended while a drawer is open.
- `pictureId` and `index` deep links, existing collection/style return contexts, and circular navigation are retained.
- Reduced-motion preferences remove the stretch/rotation and use a short calm transition.

## Images and cost

The selected 1280-wide preview is decoded before switching the displayed photograph. Adjacent previews are requested speculatively; the preload promise cache is bounded to five entries. The displayed photo remains while another loads. High resolution originals are decoded only after the active slide settles when the display size and pixel density require them. Failed loading retains the available preview or offers a retry.

Motion uses transforms and opacity. There are no displacement filters, per-frame React position updates, or continuous animation loops in the ordinary viewer.

## Validation

TypeScript (`tsc --noEmit --incremental false --pretty false`) and `git diff --check` passed. Tested at 1440×900 and 390×650: main-area click, drag, rapid forward/reverse input, footer buttons, first/last wrapping, contact-sheet jumps, current-photo details, portrait proportions, and an `index=12` deep link. The open contact sheet blocks background arrow-key navigation. No horizontal overflow was observed.

For a bounded benchmark, open `/work/97?origin=home&returnSet=97&perf=1&motion=viewer`. The test switches six times, then freezes its sample after 11 seconds. Use `?perf=1` alone for a rolling diagnostic. Ordinary URLs contain no diagnostic panel or sampling loop.

On this Mac's in-app browser, page rAF cadence during the six-switch benchmark was 119.5 fps at 1440×900 and 119.1 fps at 390×650. Both final six-second windows had a 10 ms page-frame p95 and 0% intervals above 25 ms. These are warm-preview, local-development measurements; the smaller viewport is not a physical-phone benchmark. Full samples and method limitations are recorded in `portfolio-viewer-performance.json`.
