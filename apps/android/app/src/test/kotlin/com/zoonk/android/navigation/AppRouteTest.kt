package com.zoonk.android.navigation

import androidx.compose.runtime.mutableStateOf
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppRouteTest {
    @Test
    fun everyRouteHasAScreen() {
        val navigator =
            AppNavigator(
                stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
                selected = mutableStateOf(AppTab.Today),
                tasks = NavBackStack(),
                openWebPage = {},
            )
        val entries = appEntries(AppContainer.preview(ApplicationProvider.getApplicationContext()), navigator)

        // Throws for a route no lane registered.
        routeSamples.filter { it.presentation != Presentation.Web }.forEach { route -> entries(route) }
    }
}
