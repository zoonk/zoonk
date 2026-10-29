package com.zoonk.android.feature.plan

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

/** The Plan is the list a subject or chapter it opens shows beside, where there's room for both. */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
fun EntryProviderScope<NavKey>.planEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Plan>(metadata = ListDetailSceneStrategy.listPane()) { route -> PlanScreen(app, navigator, route.focus) }
}
