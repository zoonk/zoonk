package com.zoonk.android.feature.settings

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder

/**
 * The hub is the list; its pages are the details beside it from a tablet up, with the first page
 * (Profile, or Preferences without an account) shown until another is picked, as main does.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
fun EntryProviderScope<NavKey>.settingsEntries(
    app: AppContainer,
    navigator: AppNavigator,
) {
    entry<AppRoute.Settings>(
        metadata =
            ListDetailSceneStrategy.listPane(
                detailPlaceholder = {
                    val session by app.sessions.state.collectAsStateWithLifecycle()
                    if ((session as? SessionState.SignedIn)?.isGuest == false) {
                        ProfileScreen(app, navigator)
                    } else {
                        RoutePlaceholder(AppRoute.Preferences, app, navigator)
                    }
                },
            ),
    ) { SettingsScreen(app, navigator) }
    entry<AppRoute.Preferences>(metadata = ListDetailSceneStrategy.detailPane()) { RoutePlaceholder(it, app, navigator) }
    entry<AppRoute.Profile>(metadata = ListDetailSceneStrategy.detailPane()) { ProfileScreen(app, navigator) }
}
