package com.zoonk.android.feature.goalcontent

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.goalContentEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Subject> { SubjectScreen(it, app, navigator) }
    entry<AppRoute.Chapter> { ChapterScreen(it, app, navigator) }
}
