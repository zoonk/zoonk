package com.zoonk.android.feature.mindmaps

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.mindMapsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.MindMaps> { MindMapsScreen(app, navigator) }
    entry<AppRoute.MindMap> { MindMapScreen(it, app, navigator) }
}
