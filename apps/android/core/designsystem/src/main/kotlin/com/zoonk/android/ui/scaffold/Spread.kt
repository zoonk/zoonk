package com.zoonk.android.ui.scaffold

import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.window.core.layout.WindowSizeClass

/**
 * A screen that shows as two pages: across an unfolded book's fold, and down the middle of a window
 * Material calls expanded (840dp and wider) with or without one. It decides once for the whole
 * screen, so its top bar, docked action bar, snackbars, sheets and pages ([spreadFold]) agree on
 * every frame. Phones, an outer display and narrower windows stay one column, and so does text too
 * large for two pages. Dialogs keep to the fold alone ([pageFold]): off a fold they stay centered.
 */
@Composable
fun SpreadScreen(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSpread provides spread(), content = content)
}

/** Whether the [SpreadScreen] around this shows its two pages, for what's decided beside them, such as an action bar. */
@Composable
fun spreadShows(): Boolean = LocalSpread.current?.shows == true

/**
 * Where a page [width] wide splits, for what keeps off the split (a bar, a snackbar, a sheet): inside
 * a [SpreadScreen] where it splits, elsewhere at an unfolded book's fold ([pageFold]).
 */
@Composable
fun screenSplit(
    width: Dp,
    span: PageSpan? = null,
): PageFold? {
    val spread = LocalSpread.current ?: return pageFold(width, span)
    return spread.split?.let { foldAt(listOf(it), width, span) }
}

/** Where the screen's pages meet ([split], or none), and whether they show at the text's size. */
@Immutable
internal data class Spread(
    val split: Rect?,
    val shows: Boolean,
)

internal val LocalSpread = compositionLocalOf<Spread?> { null }

@Composable
private fun spread(): Spread {
    val info = windowAdaptiveInfo()
    val density = LocalDensity.current
    val window = LocalWindowInfo.current.containerSize
    val hinge = info.windowPosture.allVerticalHingeBounds.firstOrNull()
    val middle =
        Rect(window.width / 2f, 0f, window.width / 2f, window.height.toFloat())
            .takeIf { info.windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) }
    val pages = hinge ?: middle
    val shows =
        pages != null &&
            with(density) { minOf(pages.left, window.width - pages.right).toDp() } >= MINIMUM_PANE * density.fontScale.coerceAtLeast(1f)

    // A fold stays where bars keep off even when the text is too large for two pages; a window's middle is only a split
    // while the pages show.
    return Spread(split = hinge ?: middle?.takeIf { shows }, shows = shows)
}
