package com.zoonk.android.feature.stats

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.statsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Statistics> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.StatsLevel> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.StatsEnergy> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.StatsActivity> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.StatsScore> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.StatsPatterns> { RoutePlaceholder(it, app, navigator) }
}
