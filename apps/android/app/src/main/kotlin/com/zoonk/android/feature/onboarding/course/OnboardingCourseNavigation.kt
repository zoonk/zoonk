package com.zoonk.android.feature.onboarding.course

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.onboardingCourseEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.CourseStart> { RoutePlaceholder(it, app, navigator) }
}
