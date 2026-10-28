package com.zoonk.android.feature.mock.chooser

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

fun EntryProviderScope<NavKey>.mockChooserEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.MockChooser> { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.PlacementMock> { RoutePlaceholder(it, app, navigator) }
}
