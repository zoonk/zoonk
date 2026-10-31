package com.zoonk.android.feature.today

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.todayEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Today> { TodayScreen(app, navigator) }
}
