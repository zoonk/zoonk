package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffold
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffoldRole
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth
import androidx.compose.material3.adaptive.navigation.rememberSupportingPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * A page with what helps with it beside it where there's room (main's page aside and task aside):
 * Material's supporting-pane scaffold, by the panes [pageDirective] decides. Where only one pane
 * fits, [mainPane] is told so (`supportingPaneBeside` false) and shows the supporting content its
 * own way, below its content or in a sheet, as main does under `lg`. With [panesTouch], the panes
 * meet without Material's room between them: for an aside that starts with its own hairline, so the
 * page's lists reach that hairline as they reach the window's edge, or for two pages that keep their
 * own margins on each side of a book's fold. With [halfWidth], the supporting
 * pane takes half the room, for a long passage. With [atFoldOnly], the panes split only at an
 * unfolded book foldable's fold, for a spread that wider windows show as one column. Without a
 * [supportingPane] the page is one pane, in the same place as with one, so what [mainPane] holds
 * keeps its state as a supporting pane comes or goes.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun PageWithSupportingPane(
    supportingPane: (@Composable () -> Unit)?,
    modifier: Modifier = Modifier,
    panesTouch: Boolean = false,
    halfWidth: Boolean = false,
    atFoldOnly: Boolean = false,
    mainPane: @Composable (supportingPaneBeside: Boolean) -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(modifier.onPageSpan { span = it }) {
        val directive = pageDirective(maxWidth, span, panesTouch, halfWidth, atFoldOnly, alone = supportingPane == null)
        val navigator = rememberSupportingPaneScaffoldNavigator(scaffoldDirective = directive)
        val supportingPaneBeside = navigator.scaffoldValue[SupportingPaneScaffoldRole.Supporting] == PaneAdaptedValue.Expanded

        SupportingPaneScaffold(
            directive = navigator.scaffoldDirective,
            value = navigator.scaffoldValue,
            mainPane = { AnimatedPane { mainPane(supportingPaneBeside) } },
            supportingPane = { AnimatedPane(if (halfWidth) Modifier.preferredWidth(HALF) else Modifier) { supportingPane?.invoke() } },
        )
    }
}

/**
 * Whether [PageWithSupportingPane] lays its supporting pane beside a page [width] wide, for what's
 * decided around it, such as a top bar; [panesTouch] as the page's own.
 */
@Composable
fun supportingPaneBeside(
    width: Dp,
    panesTouch: Boolean = false,
): Boolean = pageDirective(width, panesTouch = panesTouch).maxHorizontalPartitions > 1

/**
 * How a page [width] wide splits into panes, for every pane scaffold of a page (the supporting pane
 * here, the shell's list and detail): two where each keeps a phone's column, [MINIMUM_PANE] growing
 * with the text. That's where Material splits the window (expanded and wider), and on a page an
 * unfolded book foldable's fold crosses ([pageFold]), where the panes meet at the fold, flat or
 * folded, so each is a page of the book and folding moves nothing. There the fold sets each page's
 * width, so large text keeps a page and its aside a page each: one column could be no wider than
 * the page before the fold. [atFoldOnly] keeps one column where there's no fold, and [alone]
 * everywhere. Where a fold crosses a page too narrow for two panes, its one pane keeps to the page
 * before the fold if that page holds a phone's column. A lone pane is measured with its text, as a
 * spread is, or inside a [SpreadScreen] or [ResultScreen] where that screen's pages show, so a
 * result's frame keeps both pages at any text size.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun pageDirective(
    width: Dp,
    span: PageSpan? = null,
    panesTouch: Boolean = false,
    halfWidth: Boolean = false,
    atFoldOnly: Boolean = false,
    alone: Boolean = false,
): PaneScaffoldDirective {
    val room = pageRoom(width, span, panesTouch, halfWidth, atFoldOnly)
    val fold = room.fold
    val window = room.window
    val panesFit = LocalSpread.current?.takeIf { alone }?.shows ?: room.fits(withText = fold == null || alone)
    val twoPanes = !alone && panesFit
    val excluded =
        when {
            fold == null -> null

            twoPanes -> fold.bounds

            // Material lays a lone pane in the first room nothing excluded covers, counting from the left even right to left.
            !panesFit && fold.start >= MINIMUM_PANE -> fold.bounds.throughWindowEnd()

            else -> null
        }

    // Its default focuses the pane's first text field as it opens, raising the keyboard on a phone,
    // and `copy()` turns that back on, so the directive is built whole. Its default also lays the aside
    // under the page on tall windows.
    return PaneScaffoldDirective(
        maxHorizontalPartitions = if (twoPanes) window.maxHorizontalPartitions else 1,
        horizontalPartitionSpacerSize = room.spacer,
        maxVerticalPartitions = 1,
        verticalPartitionSpacerSize = window.verticalPartitionSpacerSize,
        defaultPanePreferredWidth = window.defaultPanePreferredWidth,
        defaultPanePreferredHeight = window.defaultPanePreferredHeight,
        excludedBounds = listOfNotNull(excluded),
        shouldAutoFocusCurrentDestination = false,
    )
}

private class PageRoom(
    val fold: PageFold?,
    val window: PaneScaffoldDirective,
    val spacer: Dp,
    private val narrowestPane: Dp,
    private val splits: Boolean,
    private val fontScale: Float,
) {
    fun fits(withText: Boolean): Boolean = splits && narrowestPane >= MINIMUM_PANE * (if (withText) fontScale.coerceAtLeast(1f) else 1f)
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
private fun pageRoom(
    width: Dp,
    span: PageSpan?,
    panesTouch: Boolean,
    halfWidth: Boolean,
    atFoldOnly: Boolean,
): PageRoom {
    val info = windowAdaptiveInfo()
    val fold = info.foldAcross(width, span)
    val window =
        if (fold == null) calculatePaneScaffoldDirective(info) else calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth(info)
    val spacer = if (panesTouch) 0.dp else window.horizontalPartitionSpacerSize
    val narrowestPane =
        if (fold != null) {
            minOf(fold.start, width - maxOf(fold.end, fold.start + spacer))
        } else {
            // Material gives the main pane what the supporting pane leaves, or shrinks both alike when they don't fit.
            val supporting = if (halfWidth) width / 2 else window.defaultPanePreferredWidth
            val room = width - spacer
            val preferred = window.defaultPanePreferredWidth + supporting
            if (room >=
                preferred
            ) {
                minOf(supporting, room - supporting)
            } else {
                minOf(window.defaultPanePreferredWidth, supporting) *
                    (room / preferred)
            }
        }
    val splits = window.maxHorizontalPartitions > 1 && (fold != null || !atFoldOnly)

    return PageRoom(fold, window, spacer, narrowestPane, splits, LocalDensity.current.fontScale)
}

/** The fold and the window after it, from the start edge as the layout reads. */
@Composable
private fun Rect.throughWindowEnd(): Rect =
    if (LocalLayoutDirection.current == LayoutDirection.Ltr) {
        copy(
            right =
                LocalWindowInfo.current.containerSize.width
                    .toFloat(),
        )
    } else {
        copy(left = 0f)
    }

/**
 * Where a page [width] wide spreads into two pages: inside a [SpreadScreen] where that screen's pages
 * meet, while they show; elsewhere across an unfolded book's fold, where it crosses the page and both
 * pages have room for a phone's column at the text's size, measured as a task's lone frame measures
 * it. Null where the page stays one column.
 */
@Composable
fun spreadFold(
    width: Dp,
    span: PageSpan?,
): PageFold? {
    LocalSpread.current?.let { spread -> return if (spread.shows) screenSplit(width, span) else null }
    val fold = pageFold(width, span) ?: return null
    return fold.takeIf { pageRoom(width, span = null, panesTouch = true, halfWidth = false, atFoldOnly = false).fits(withText = true) }
}

/**
 * Where an unfolded book foldable's fold crosses a page [width] wide, flat or folded, or null where
 * none does. The page spans [span] of the window ([onPageSpan]), or the window's end before it's
 * placed, where the shell lays pages beside its navigation.
 */
@Composable
fun pageFold(
    width: Dp,
    span: PageSpan? = null,
): PageFold? = windowAdaptiveInfo().foldAcross(width, span)

@Composable
private fun WindowAdaptiveInfo.foldAcross(
    width: Dp,
    span: PageSpan?,
): PageFold? = foldAt(windowPosture.allVerticalHingeBounds, width, span)

/** The first of [splits] (in the window) that crosses a page [width] wide, from the page's start edge. */
@Composable
internal fun foldAt(
    splits: List<Rect>,
    width: Dp,
    span: PageSpan?,
): PageFold? {
    val density = LocalDensity.current
    val direction = LocalLayoutDirection.current
    val page =
        span ?: PageSpan.atWindowEnd(
            LocalWindowInfo.current.containerSize.width
                .toFloat(),
            with(density) { width.toPx() },
            direction,
        )
    val fold = splits.firstOrNull { it.left > page.left && it.right < page.right } ?: return null
    val start = if (direction == LayoutDirection.Ltr) fold.left - page.left else page.right - fold.right

    return with(density) { PageFold(start.toDp(), (start + fold.width).toDp(), fold) }
}

/** A fold across a page: where it starts and ends from the page's start edge, and its [bounds] in the window. */
data class PageFold(
    val start: Dp,
    val end: Dp,
    val bounds: Rect,
)

/** Where a page sits across its window, in pixels. */
data class PageSpan(
    val left: Float,
    val right: Float,
) {
    companion object {
        fun atWindowEnd(
            windowWidth: Float,
            pageWidth: Float,
            direction: LayoutDirection,
        ) = if (direction == LayoutDirection.Ltr) PageSpan(windowWidth - pageWidth, windowWidth) else PageSpan(0f, pageWidth)
    }
}

/**
 * Reports where this layout sits across its window, for [pageFold] and [pageDirective]. A placement
 * that's scaled or partly off the window (a page shrinking under predictive back) isn't reported, so
 * the page keeps the panes it had.
 */
fun Modifier.onPageSpan(onSpan: (PageSpan) -> Unit): Modifier =
    onPlaced { coordinates ->
        val bounds = coordinates.boundsInWindow()
        if (bounds.width == coordinates.size.width.toFloat()) onSpan(PageSpan(bounds.left, bounds.right))
    }

/** The narrowest page a book foldable leaves beside the navigation rail: a 673dp Galaxy Z Fold's 256dp, with room to spare. */
internal val MINIMUM_PANE = 240.dp

private const val HALF = 0.5f
