package com.zoonk.android.feature.checkpoint

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.checkpointEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Checkpoint> { RoutePlaceholder(it, app, navigator) }
}
