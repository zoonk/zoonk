package com.zoonk.android.feature.buddy

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.buddyEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Buddy> { BuddyScreen(it, app, navigator) }
    entry<AppRoute.EarlierQuestions> { EarlierQuestionsScreen(app, navigator) }
}
