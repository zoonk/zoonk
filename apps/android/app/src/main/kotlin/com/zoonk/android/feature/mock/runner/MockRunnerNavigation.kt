package com.zoonk.android.feature.mock.runner

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.mockRunnerEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Mock> { RoutePlaceholder(it, app, navigator) }
}
