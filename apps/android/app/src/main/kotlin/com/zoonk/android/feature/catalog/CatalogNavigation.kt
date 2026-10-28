package com.zoonk.android.feature.catalog

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.catalogEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Catalog> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.CatalogCourse> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.CatalogChapter> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.CatalogLesson> { RoutePlaceholder(it, app, navigator) }
}
