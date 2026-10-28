package com.zoonk.android.feature.search

import androidx.compose.runtime.Composable
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator

/**
 * Search under the tab roots' top app bar (main's command palette, DECISIONS #4): a Material
 * `SearchBar` whose results open through [AppNavigator]. Empty until the search lane builds it.
 */
@Composable
fun TabSearchBar(
    app: AppContainer,
    navigator: AppNavigator,
) {
}
