package com.zoonk.android.feature.catalog

import androidx.activity.ComponentActivity
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class CatalogGoalDraftTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** Unfolding recreates the activity, and the fold moves the courses, the goal box with them, to the page after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun theGoalTheLearnerTypedSurvivesUnfolding() {
        val store =
            CatalogStore(FakeCatalogApi(), AppCache(FakeSession(null), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
        val restoration = StateRestorationTester(rule)
        restoration.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                CatalogScreen(AppRoute.Catalog(), app, rememberAppNavigator(), store)
            }
        }
        rule.onNode(hasSetTextAction()).performTextInput("pass the bar exam")

        restoration.emulateSavedInstanceStateRestore()
        rule.unfoldBook(folds)

        rule.onNode(hasSetTextAction()).assert(hasText("pass the bar exam"))
    }
}
