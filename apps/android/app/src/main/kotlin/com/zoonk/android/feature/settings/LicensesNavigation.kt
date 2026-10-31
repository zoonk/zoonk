package com.zoonk.android.feature.settings

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

/** Settings' licenses page, registered by the app because it reads the license list the app module generates. */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
fun EntryProviderScope<NavKey>.licensesEntries(navigator: AppNavigator) {
    entry<AppRoute.Licenses>(metadata = ListDetailSceneStrategy.detailPane()) { LicensesScreen(navigator) }
}
