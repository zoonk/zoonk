package com.zoonk.android.ui.scaffold

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffold
import androidx.compose.material3.adaptive.layout.SupportingPaneScaffoldRole
import androidx.compose.material3.adaptive.navigation.rememberSupportingPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

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
    val navigator = rememberSupportingPaneScaffoldNavigator()
    val supportingPaneBeside = navigator.scaffoldValue[SupportingPaneScaffoldRole.Supporting] == PaneAdaptedValue.Expanded

    SupportingPaneScaffold(
        directive = navigator.scaffoldDirective,
        value = navigator.scaffoldValue,
        modifier = modifier,
        mainPane = { AnimatedPane { mainPane(supportingPaneBeside) } },
        supportingPane = { AnimatedPane { supportingPane() } },
    )
}
