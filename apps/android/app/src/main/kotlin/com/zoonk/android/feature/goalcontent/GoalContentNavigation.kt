package com.zoonk.android.feature.goalcontent

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

/** A subject or chapter the Plan opens shows beside the Plan where there's room for both. */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
fun EntryProviderScope<NavKey>.goalContentEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Subject>(metadata = ListDetailSceneStrategy.detailPane()) { SubjectScreen(it, app, navigator) }
    entry<AppRoute.Chapter>(metadata = ListDetailSceneStrategy.detailPane()) { ChapterScreen(it, app, navigator) }
}
