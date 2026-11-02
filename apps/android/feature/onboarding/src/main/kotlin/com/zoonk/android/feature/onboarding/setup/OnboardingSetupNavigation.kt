package com.zoonk.android.feature.onboarding.setup

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

fun EntryProviderScope<NavKey>.onboardingSetupEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.GoalSetup> { route -> GoalSetupScreen(route, app, navigator) }
}
