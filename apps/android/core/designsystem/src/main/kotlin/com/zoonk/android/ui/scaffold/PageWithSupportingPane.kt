package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
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
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlin.math.min

/**
 * A page with what helps with it beside it where there's room (main's page aside and task aside):
 * Material's supporting-pane scaffold, by the panes [pageDirective] decides. Where only one pane
 * fits, [mainPane] is told so (`supportingPaneBeside` false) and shows the supporting content its
 * own way, below its content or in a sheet, as main does under `lg`. With [panesTouch], the panes
 * meet without Material's room between them, for an aside that starts with its own hairline, so the
 * page's lists reach that hairline as they reach the window's edge. With [halfWidth], the supporting
 * pane takes half the room, for a long passage.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun PageWithSupportingPane(
    supportingPane: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    panesTouch: Boolean = false,
    halfWidth: Boolean = false,
    mainPane: @Composable (supportingPaneBeside: Boolean) -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(modifier.onPlaced { span = it.boundsInWindow().let { bounds -> PageSpan(bounds.left, bounds.right) } }) {
        val directive = pageDirective(maxWidth, span, panesTouch, halfWidth)
        val navigator = rememberSupportingPaneScaffoldNavigator(scaffoldDirective = directive)
        val supportingPaneBeside = navigator.scaffoldValue[SupportingPaneScaffoldRole.Supporting] == PaneAdaptedValue.Expanded

        SupportingPaneScaffold(
            directive = navigator.scaffoldDirective,
            value = navigator.scaffoldValue,
            mainPane = { AnimatedPane { mainPane(supportingPaneBeside) } },
            supportingPane = { AnimatedPane(if (halfWidth) Modifier.preferredWidth(HALF) else Modifier) { supportingPane() } },
        )
    }
}

/** Whether [PageWithSupportingPane] lays its supporting pane beside a page [width] wide, for what's decided around it, such as a top bar. */
@Composable
fun supportingPaneBeside(width: Dp): Boolean = pageDirective(width).maxHorizontalPartitions > 1

/**
 * How a page [width] wide splits into panes, for every pane scaffold of a page (the supporting pane
 * here, the shell's list and detail): two where each keeps a phone's column, [MINIMUM_PANE] growing
 * with the text. That's where Material splits the window (expanded and wider), and on a page an
 * unfolded book foldable's fold crosses, where the panes meet at the fold, flat or folded, so each is
 * a page of the book and folding moves nothing. The page spans [span] of the window, or the window's
 * end before it's placed, where the shell lays pages beside its navigation.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun pageDirective(
    width: Dp,
    span: PageSpan? = null,
    panesTouch: Boolean = false,
    halfWidth: Boolean = false,
): PaneScaffoldDirective {
    val info = currentWindowAdaptiveInfoV2()
    val density = LocalDensity.current
    val pageWidth = with(density) { width.toPx() }
    val page =
        span ?: PageSpan.atWindowEnd(
            LocalWindowInfo.current.containerSize.width
                .toFloat(),
            pageWidth,
            LocalLayoutDirection.current,
        )
    val fold = info.windowPosture.allVerticalHingeBounds.firstOrNull { it.left > page.left && it.right < page.right }
    val window =
        if (fold == null) calculatePaneScaffoldDirective(info) else calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth(info)
    val narrowestPane =
        when {
            fold != null -> min(fold.left - page.left, page.right - fold.right)
            halfWidth -> pageWidth / 2
            else -> pageWidth - with(density) { window.defaultPanePreferredWidth.toPx() }
        }
    val twoPanes =
        window.maxHorizontalPartitions > 1 && narrowestPane >= with(density) { MINIMUM_PANE.toPx() } * density.fontScale.coerceAtLeast(1f)

    // Its default focuses the pane's first text field as it opens, raising the keyboard on a phone,
    // and `copy()` turns that back on, so the directive is built whole. Its default also lays the aside
    // under the page on tall windows.
    return PaneScaffoldDirective(
        maxHorizontalPartitions = if (twoPanes) window.maxHorizontalPartitions else 1,
        horizontalPartitionSpacerSize = if (panesTouch) 0.dp else window.horizontalPartitionSpacerSize,
        maxVerticalPartitions = 1,
        verticalPartitionSpacerSize = window.verticalPartitionSpacerSize,
        defaultPanePreferredWidth = window.defaultPanePreferredWidth,
        defaultPanePreferredHeight = window.defaultPanePreferredHeight,
        // Material splits at an excluded fold, but it would also squeeze a lone pane beside one.
        excludedBounds = if (twoPanes && fold != null) listOf(fold) else emptyList(),
        shouldAutoFocusCurrentDestination = false,
    )
}

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

/** The narrowest page a book foldable leaves beside the navigation rail: a 673dp Galaxy Z Fold's 256dp, with room to spare. */
private val MINIMUM_PANE = 240.dp

private const val HALF = 0.5f
