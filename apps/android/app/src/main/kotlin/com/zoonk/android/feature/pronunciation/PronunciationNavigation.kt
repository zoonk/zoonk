package com.zoonk.android.feature.pronunciation

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.pronunciationEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Pronunciation> { route -> PronunciationScreen(route, app, navigator) }
}
