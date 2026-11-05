package com.zoonk.android.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.scaffold.TaskScaffold

@Composable
fun TaskNotFound(navigator: AppNavigator) {
    TaskScaffold(onClose = navigator::closeTask) { padding ->
        NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(padding))
    }
}
