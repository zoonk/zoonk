package com.zoonk.android.feature.settings

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.settingsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Settings> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.Preferences> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.Profile> { RoutePlaceholder(it, app, navigator) }
}
