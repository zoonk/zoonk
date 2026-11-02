package com.zoonk.android.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.scaffold.TaskScaffold

@Composable
fun RouteFrame(
    route: AppRoute,
    navigator: AppNavigator,
    content: @Composable (PaddingValues) -> Unit,
) {
    when (route.presentation) {
        is Presentation.Tab -> {
            TabRootScaffold(content = content)
        }

        Presentation.Task -> {
            TaskScaffold(onClose = navigator::closeTask, content = content)
        }

        else -> {
            PageScaffold(onBack = { navigator.back() }, content = content)
        }
    }
}
