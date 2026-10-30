package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffold
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffoldRole
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.material3.adaptive.navigation.rememberSupportingPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/**
 * A page with what helps with it beside it where there's room (main's page aside and task aside):
 * Material's supporting-pane scaffold, which keeps both panes off a fold's hinge. Where only one
 * pane fits, [mainPane] is told so (`supportingPaneBeside` false) and shows the supporting content
 * its own way, below its content or in a sheet, as main does under `lg`. With [panesTouch], the panes
 * meet without Material's room between them, for an aside that starts with its own hairline, so the
 * page's lists reach that hairline as they reach the window's edge.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun PageWithSupportingPane(
    supportingPane: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    panesTouch: Boolean = false,
    mainPane: @Composable (supportingPaneBeside: Boolean) -> Unit,
) {
    BoxWithConstraints(modifier) {
        val navigator = rememberSupportingPaneScaffoldNavigator(scaffoldDirective = paneDirective(maxWidth, panesTouch))
        val supportingPaneBeside = navigator.scaffoldValue[SupportingPaneScaffoldRole.Supporting] == PaneAdaptedValue.Expanded

        SupportingPaneScaffold(
            directive = navigator.scaffoldDirective,
            value = navigator.scaffoldValue,
            mainPane = { AnimatedPane { mainPane(supportingPaneBeside) } },
            supportingPane = { AnimatedPane { supportingPane() } },
        )
    }
}

/** Whether [PageWithSupportingPane] lays its supporting pane beside a page [width] wide, for what's decided around it, such as a top bar. */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun supportingPaneBeside(width: Dp): Boolean = paneDirective(width).maxHorizontalPartitions > 1

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
private fun paneDirective(
    width: Dp,
    panesTouch: Boolean = false,
): PaneScaffoldDirective {
    // Material reads the window, but a rail or drawer beside the page can leave it a phone's width,
    // as on an unfolded foldable. Its default also lays the aside under the page on tall windows.
    val window = calculatePaneScaffoldDirective(currentWindowAdaptiveInfoV2())
    val roomForTwo = width >= WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND.dp
    // Its default focuses the pane's first text field as it opens, raising the keyboard on a phone,
    // and `copy()` turns that back on, so the directive is built whole.
    return PaneScaffoldDirective(
        maxHorizontalPartitions = if (roomForTwo) window.maxHorizontalPartitions else 1,
        horizontalPartitionSpacerSize = if (panesTouch) 0.dp else window.horizontalPartitionSpacerSize,
        maxVerticalPartitions = 1,
        verticalPartitionSpacerSize = window.verticalPartitionSpacerSize,
        defaultPanePreferredWidth = window.defaultPanePreferredWidth,
        defaultPanePreferredHeight = window.defaultPanePreferredHeight,
        excludedBounds = window.excludedBounds,
        shouldAutoFocusCurrentDestination = false,
    )
}
