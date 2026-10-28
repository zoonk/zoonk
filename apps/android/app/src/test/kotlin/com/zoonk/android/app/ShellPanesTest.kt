package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.compose.runtime.remember
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w1280dp-h800dp-land")
class ShellPanesTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private lateinit var navigator: AppNavigator

    @Before
    fun show() {
        rule.setContent {
            navigator = rememberAppNavigator()
            val entries =
                remember(navigator) {
                    entryProvider<NavKey>(fallback = { key -> NavEntry(key) { Text(key.toString()) } }) {
                        entry<AppRoute.Settings>(metadata = ListDetailSceneStrategy.listPane()) { Text("Settings list") }
                        entry<AppRoute.Preferences>(metadata = ListDetailSceneStrategy.detailPane()) { Text("Preferences detail") }
                    }
                }
            AppShell(navigator, entries)
        }
    }

    @Test
    fun aListAndItsDetailShareTheWindow() {
        rule.runOnIdle { navigator.open(AppRoute.Settings) }
        rule.runOnIdle { navigator.open(AppRoute.Preferences) }

        rule.onNodeWithText("Settings list").assertIsDisplayed()
        rule.onNodeWithText("Preferences detail").assertIsDisplayed()
    }

    @Test
    fun anotherTabsListNeverPairsWithThisTabsDetail() {
        rule.runOnIdle { navigator.open(AppRoute.Settings) }
        rule.runOnIdle { navigator.select(AppTab.Plan) }
        rule.runOnIdle { navigator.open(AppRoute.Preferences) }

        rule.onNodeWithText("Preferences detail").assertIsDisplayed()
        rule.onNodeWithText("Settings list").assertDoesNotExist()
    }
}
