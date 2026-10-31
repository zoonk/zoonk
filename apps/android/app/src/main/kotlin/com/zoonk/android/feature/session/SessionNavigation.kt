package com.zoonk.android.feature.session

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.sessionEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Session> { SessionScreen(it, app, navigator) }
}
