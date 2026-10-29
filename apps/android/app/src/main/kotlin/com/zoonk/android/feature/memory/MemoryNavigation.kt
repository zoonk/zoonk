package com.zoonk.android.feature.memory

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
fun EntryProviderScope<NavKey>.memoryEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Memory>(metadata = ListDetailSceneStrategy.detailPane()) { RoutePlaceholder(it, app, navigator) }
}
