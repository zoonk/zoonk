package com.zoonk.android.feature.stats

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.statsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Statistics> { StatsScreen(StatsPage.Overview, app, navigator) }
    entry<AppRoute.StatsLevel> { StatsScreen(StatsPage.Level, app, navigator) }
    entry<AppRoute.StatsEnergy> { StatsScreen(StatsPage.Energy, app, navigator) }
    entry<AppRoute.StatsActivity> { StatsScreen(StatsPage.Activity, app, navigator) }
    entry<AppRoute.StatsScore> { StatsScreen(StatsPage.Score, app, navigator) }
    entry<AppRoute.StatsPatterns> { StatsScreen(StatsPage.Patterns, app, navigator) }
}
