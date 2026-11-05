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
 * screen, so its frame, top bar, docked action bar, snackbars, sheets and pages ([spreadFold]) agree
 * on every frame. Phones, an outer display and narrower windows stay one column, and so does text too
 * large for two pages, except while the screen shows its [result] ([ResultPages]): the fold sets each
 * page's width, so a result keeps its two pages there at any text size. Dialogs keep to the fold alone
 * ([pageFold]): off a fold they stay centered.
 */
@Composable
fun SpreadScreen(
    result: Boolean = false,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalSpread provides spread(acrossWindow = true, result = result), content = content)
}

/**
 * A result outside a [SpreadScreen] (a run's, a summary, the logbook): as a spread does, it decides
 * once for the screen where its pages ([ResultPages]) and bars meet, which is only across an unfolded
 * book's fold, at any text size there. Elsewhere it's one column.
 */
@Composable
fun ResultScreen(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSpread provides spread(acrossWindow = false, result = true), content = content)
}

/** Whether the [SpreadScreen] around this shows its two pages, for what's decided beside them, such as an action bar. */
@Composable
fun spreadShows(): Boolean = LocalSpread.current?.shows == true

/**
 * Whether this sits on a book's page: anywhere in a window an unfolded book's fold crosses, or on a
 * [SpreadScreen]'s page while it shows two. A book's page is about a phone wide, so what follows
 * main's breakpoints there lays out as on a phone.
 */
@Composable
fun isOnBookPage(): Boolean = windowAdaptiveInfo().windowPosture.allVerticalHingeBounds.isNotEmpty() || spreadShows()

/** Main's `sm` and `md`: a medium or wider window, except on a book's page ([isOnBookPage]), which lays out as on a phone. */
@Composable
fun isMediumLayout(): Boolean =
    windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND) && !isOnBookPage()

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

/** Where the screen's pages meet ([split], or none), and whether they show. */
@Immutable
internal data class Spread(
    val split: Rect?,
    val shows: Boolean,
)

internal val LocalSpread = compositionLocalOf<Spread?> { null }

@Composable
private fun spread(
    acrossWindow: Boolean,
    result: Boolean,
): Spread {
    val info = windowAdaptiveInfo()
    val density = LocalDensity.current
    val window = LocalWindowInfo.current.containerSize
    val hinge = info.windowPosture.allVerticalHingeBounds.firstOrNull()
    val middle =
        Rect(window.width / 2f, 0f, window.width / 2f, window.height.toFloat())
            .takeIf { acrossWindow && info.windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) }
    val pages = hinge ?: middle
    val textScale = if (result && hinge != null) 1f else density.fontScale.coerceAtLeast(1f)
    val shows = pages != null && with(density) { minOf(pages.left, window.width - pages.right).toDp() } >= MINIMUM_PANE * textScale

    // A fold stays where bars keep off even when the text is too large for two pages; a window's middle is only a split
    // while the pages show.
    return Spread(split = hinge ?: middle?.takeIf { shows }, shows = shows)
}
