package com.zoonk.android.feature.catalog

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.catalogEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Catalog> { CatalogScreen(it, app, navigator) }
    entry<AppRoute.CatalogCourse> { CourseScreen(it, app, navigator) }
    entry<AppRoute.CatalogChapter> { ChapterScreen(it, app, navigator) }
    entry<AppRoute.CatalogLesson> { LessonScreen(it, app, navigator) }
}
