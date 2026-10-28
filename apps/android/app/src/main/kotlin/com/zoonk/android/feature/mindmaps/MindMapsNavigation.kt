package com.zoonk.android.feature.mindmaps

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.mindMapsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.MindMaps> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.MindMap> { RoutePlaceholder(it, app, navigator) }
}
