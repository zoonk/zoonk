# Android screens without an emulator

How to look at the Android app's screens and measure their layout on the JVM, with no emulator. What only a running app shows (system bars, timing, TalkBack, requests, memory) is in [measuring the Android app](android.md).

## Render a screen

Robolectric renders real screens on the JVM in seconds. Use it to check every window size, dark theme, more contrast and large text before opening an emulator. `app/src/testDebug/kotlin/com/zoonk/android/gallery/GalleryScreenshots.kt` is the pattern: `@GraphicsMode(NATIVE)`, Compose UI test v2's `createAndroidComposeRule`, one test per `@Config(qualifiers = "w411dp-h891dp-xxhdpi")` size (`-night` for dark, `RuntimeEnvironment.setFontScale(2f)` for 200%), and the shared `com.zoonk.android.ui.testing.captureRender` from `:core:designsystem` test fixtures, written to a folder only when one is passed:

```sh
./gradlew :feature:today:testDebugUnitTest --tests '*Screenshots*' --rerun -Pzoonk.shots=/path/to/folder
```

Use `captureRender()` on one selected Compose root, tagged node, or dialog for JVM captures. When several roots are open, select the intended root explicitly. It settles composition and layout, invalidates the selected Compose view, then lets Compose’s capture idle pass draw before PixelCopy reads the window surface. `captureToImage()` alone can copy an empty first frame on SDK 37 even after `waitForIdle()`; extra waits and repeated captures do not establish that a new frame was drawn.

Run the test task of the module that owns the screen (`:app` for the gallery and the shell); each module writes its reports under its own `build/`.

Read the PNGs. Images aren't committed and CI doesn't compare pixels. A render shows layout, color and type; it doesn't show system bars, timing or TalkBack, so the emulator check still follows for runtime behavior.

## Layout capture

With `-Pzoonk.shots=<folder>`, each render taken with `captureRender()` and saved with `writeRender()` also writes its layout beside the picture as `<name>.json`, so the [alignment check](pages.md#alignment) judges Android's screens by the web's rules: run `pnpm verify:alignment <folder>`. Without the flag, nothing is measured or written. Commit first: each file records the build's commit and a digest of uncommitted changes.

The capture reads the unmerged semantics tree of the frame `captureRender()` copied, in dp from the picture's top start: each part's bounds; a text's first baseline, its capitals from the font file's own cap height, its line bounds, line count and type (`Geist 14 500 20`); ink from the picture's pixels; how many descriptions a row drew; each filled action and its surface (a dialog's window is its own); and the size, locale, font scale and night mode. What the tree or the picture can't give is written "not measured", never estimated, and fails the check. Pass `captureRender(scenario = "<id>")` to name the state.

A shared piece names its parts with `Modifier.layoutPart(piece, part)` (`LayoutParts.kt`, debug builds only), with the piece's name from the table (`LayoutPart.LIST`, `CHOICES`, `NAVIGATION`, `WAIT`, `GENERATION_WAIT`), and gives the group's `gap` and a row's `endInset` where its layout has them. `ListRow` records a text lead as `lead` and an icon as `mark`. A new piece is declared in `alignment-table.mts` first (a piece with no `web` when the web has no twin). Rows no piece frames are grouped by the stack that holds them, and their findings are discovery leads, never failures: frame them with the list piece to make them count.

A dialog or a sheet is a window of its own: with one open, `onRoot()` fails on two roots, so capture `onNode(isDialog())` or the last root (`onAllNodes(isRoot()).onLast()`). The picture is that window alone, without the page and the dim behind it, and its capture counts filled actions on its own surface. Robolectric's PixelCopy of a dialog's window returns the page behind it, cut to the dialog's bounds, so `captureRender()` draws a dialog's window root itself: the picture is the dialog's surface on a transparent corner. A picture that must show the sheet over its page comes from an emulator, taken by `pnpm pr:media device --platform android` and shown in the PR's device section ([the picture gate](../../zoonk-commit/references/picture-gate.md)). The Debug build doesn't stamp its commit (a value that changes every commit would cost every incremental build), so install a build of the committed head first: the command refuses an app installed before the head's last change to `apps/android` or `packages/`, or with that code uncommitted.

To put renders in a PR, `pnpm pr:media adopt <before|after> <render.json>...` copies each picture into a capture folder (`tmp/pr-media/android/<side>` by default, `--to <dir>` for another) with its record in `capture.json` and its layout in `alignment.json`. It refuses a render whose picture changed after it was measured. The [picture gate](../../zoonk-commit/references/picture-gate.md) then judges it like any other.

What it can't measure, as the capture states:

- A text whose own semantics were cleared (`clearAndSetSemantics`, so TalkBack does not repeat the chart summary): its layout action is unavailable and is recorded as an `unmeasured` area with a reason. Unmerged descendants below a cleared container are still read; this recovers chart legends and list-row parts. Missing metrics inside a declared alignment group still fail that group.
- The middle of text a fallback font drew with no capitals and no ideographic face (Arabic in a Geist style, or a span in another family), so that row's line isn't measured. Japanese and Korean are measured by their ideographic face.
- Ink of text that is clipped, covered (wholly, partly or by a gradient), drawn with a brush, or dimmed by its parent so no pixel is its own color; and of a dimmed part whose faint edge doesn't reach its box, such as a disabled outline button.
- Lazy rows that weren't composed.
- A picture that isn't the one frame `captureRender()` copied (a copy, several windows drawn together): its file says so and holds no parts.
- A scheme a test passes its theme itself: only the configuration's night mode is recorded. The pointer is always touch.
