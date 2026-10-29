package com.zoonk.android.feature.checkpoint

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.conversation.LanguageCheckpointCall
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.checkpointEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Checkpoint> { route ->
        LanguageCheckpointCall(route, app, navigator) { CheckpointScreen(route, app, navigator) }
    }
}
