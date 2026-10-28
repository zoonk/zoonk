package com.zoonk.android.feature.account

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.accountEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Login> { RoutePlaceholder(it, app, navigator) }
}
