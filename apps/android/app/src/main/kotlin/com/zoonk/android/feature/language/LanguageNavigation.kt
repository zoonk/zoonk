package com.zoonk.android.feature.language

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.languageEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.LanguageUnit> { LanguageUnitScreen(it, app, navigator) }
}
