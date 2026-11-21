package com.zoonk.android.feature.placementtest

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.placementTestEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.PlacementTest> { PlacementTestScreen(it, app, navigator) }
    entry<AppRoute.LevelTest> { LevelTestScreen(it, app, navigator) }
}
