package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
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
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w1280dp-h800dp-land")
class ShellPanesTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
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
                        entry<AppRoute.Preferences>(metadata = ListDetailSceneStrategy.detailPane()) {
                            Box(Modifier.fillMaxSize().testTag("detail")) { Text("Preferences detail") }
                        }
                    }
                }
            AppShell(navigator, entries, onSendFeedback = {})
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

    /** An unfolded book foldable folded halfway: the list is the page before the fold, its detail the page after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aListAndItsDetailMeetAtAnOpenBooksFold() {
        rule.waitForIdle()
        val fold =
            FoldingFeature(rule.activity, state = FoldingFeature.State.HALF_OPENED, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.runOnIdle { navigator.open(AppRoute.Settings) }
        rule.runOnIdle { navigator.open(AppRoute.Preferences) }

        val list = rule.onNodeWithText("Settings list").assertIsDisplayed().getUnclippedBoundsInRoot()
        val detail = rule.onNodeWithText("Preferences detail").assertIsDisplayed().getUnclippedBoundsInRoot()
        assertTrue("the list ends at the fold: $list", list.right <= 426.dp)
        assertTrue("the detail starts at the fold: $detail", detail.left >= 426.dp)
    }

    /** A detail opened on its own, as Subscription from the account menu, is a page of its own beside the rail. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aDetailOpenedOnItsOwnFillsThePage() {
        rule.waitForIdle()
        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.runOnIdle { navigator.open(AppRoute.Preferences) }

        val detail = rule.onNodeWithTag("detail").assertIsDisplayed().getUnclippedBoundsInRoot()
        assertEquals(772f, detail.width.value, 0.5f)
    }
}
