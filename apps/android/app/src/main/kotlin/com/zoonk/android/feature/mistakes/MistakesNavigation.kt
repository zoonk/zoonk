package com.zoonk.android.feature.mistakes

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.mistakesEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Mistakes> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.MistakePractice> { MistakePracticeScreen(it, app, navigator) }
}
