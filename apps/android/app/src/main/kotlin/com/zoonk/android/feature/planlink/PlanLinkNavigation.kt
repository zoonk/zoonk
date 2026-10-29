package com.zoonk.android.feature.planlink

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.planLinkEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.PlanLink> { PlanLinkScreen(it, app, navigator) }
}
