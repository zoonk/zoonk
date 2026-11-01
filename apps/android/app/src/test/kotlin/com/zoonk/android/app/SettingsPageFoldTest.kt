package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w852dp-h883dp")
class SettingsPageFoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** A settings page opened on its own faces the settings list only at a fold, and keeps what it holds as the list comes and goes. */
    @Test
    fun aSettingsPageOnItsOwnKeepsWhatItHoldsAsTheBookOpensAndCloses() {
        lateinit var navigator: AppNavigator
        rule.setContent {
            navigator = rememberAppNavigator()
            val entries =
                remember(navigator) {
                    entryProvider<NavKey>(fallback = { key -> NavEntry(key) { Text(key.toString()) } }) {
                        entry<AppRoute.Settings>(metadata = ListDetailSceneStrategy.listPane()) { Text("Settings list") }
                        entry<AppRoute.Preferences>(metadata = ListDetailSceneStrategy.detailPane()) {
                            var taps by remember { mutableIntStateOf(0) }
                            Text("Taps $taps", Modifier.testTag("taps").clickable { taps++ })
                        }
                    }
                }
            AppShell(navigator, entries, onSendFeedback = {})
        }
        rule.runOnIdle { navigator.open(AppRoute.Preferences) }
        rule.waitForIdle()
        rule.onNodeWithTag("taps").performClick()

        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()
        rule.onNodeWithText("Settings list").assertIsDisplayed()
        rule.onNodeWithText("Taps 1").assertIsDisplayed()

        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(emptyList()))
        rule.waitForIdle()
        rule.onNodeWithText("Settings list").assertDoesNotExist()
        rule.onNodeWithText("Taps 1").assertIsDisplayed()
    }
}
