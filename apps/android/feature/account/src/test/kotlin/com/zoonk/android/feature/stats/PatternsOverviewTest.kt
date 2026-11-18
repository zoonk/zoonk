package com.zoonk.android.feature.stats

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Statistics where its list sits beside the page and the patterns share a row with the score, so the patterns'
 * column is narrow: "Best day" and "Best time" rows about 290dp wide. Real font metrics, so the words wrap as on a device.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w1000dp-h1400dp-xhdpi")
class PatternsOverviewTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aBestDayThatNoDayStandsOutForMovesUnderItsLabelInANarrowColumn() {
        show(FakeStatsApi(studied = true, dayVerdict = """{"kind":"even","points":4}"""))

        val label = compose.onNodeWithText("Best day", useUnmergedTree = true).getBoundsInRoot()
        val answer = compose.onNodeWithText("You answer about the same every day.", useUnmergedTree = true).getBoundsInRoot()

        assertTrue("the answer ($answer) starts under the label ($label)", answer.top >= label.bottom)
        assertEquals(label.left, answer.left)
    }

    private fun show(api: StatsApi) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val context = LocalContext.current
                    val app = remember { AppContainer.preview(context) }
                    val session = remember { FakeSession(AuthenticatedSession("account", "token", "local")) }
                    val stats =
                        remember { StatsStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))) }
                    StatsScreen(StatsPage.Overview, app, rememberAppNavigator(), stats)
                }
            }
        }
    }
}
