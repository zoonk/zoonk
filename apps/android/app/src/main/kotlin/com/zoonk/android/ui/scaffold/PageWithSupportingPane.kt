package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffold
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffoldRole
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.material3.adaptive.navigation.rememberSupportingPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusTarget
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/**
 * A page with what helps with it beside it where there's room (main's page aside and task aside):
 * Material's supporting-pane scaffold, which keeps both panes off a fold's hinge. Where only one
 * pane fits, [mainPane] is told so (`supportingPaneBeside` false) and shows the supporting content
 * its own way, below its content or in a sheet, as main does under `lg`.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun PageWithSupportingPane(
    supportingPane: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    mainPane: @Composable (supportingPaneBeside: Boolean) -> Unit,
) {
    BoxWithConstraints(modifier) {
        // Material reads the window, but a rail or drawer beside the page can leave it a phone's width,
        // as on an unfolded foldable. Its default also lays the aside under the page on tall windows.
        val window = calculatePaneScaffoldDirective(currentWindowAdaptiveInfoV2())
        val roomForTwo = maxWidth >= WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND.dp
        val navigator =
            rememberSupportingPaneScaffoldNavigator(
                scaffoldDirective =
                    window.copy(
                        maxHorizontalPartitions = if (roomForTwo) window.maxHorizontalPartitions else 1,
                        maxVerticalPartitions = 1,
                    ),
            )
        val supportingPaneBeside = navigator.scaffoldValue[SupportingPaneScaffoldRole.Supporting] == PaneAdaptedValue.Expanded

        SupportingPaneScaffold(
            directive = navigator.scaffoldDirective,
            value = navigator.scaffoldValue,
            mainPane = { AnimatedPane { PaneFocus { mainPane(supportingPaneBeside) } } },
            supportingPane = { AnimatedPane { PaneFocus { supportingPane() } } },
        )
    }
}

/**
 * The scaffold moves focus into its pane as it opens, which lands on the pane's first text field on
 * a touch screen and opens the keyboard. The pane takes that focus itself; its fields wait for a tap.
 */
@Composable
private fun PaneFocus(content: @Composable () -> Unit) {
    Box(Modifier.focusTarget()) { content() }
}
