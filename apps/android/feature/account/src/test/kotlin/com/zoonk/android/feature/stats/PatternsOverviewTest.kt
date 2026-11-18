package com.zoonk.android.feature.stats

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
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
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Statistics on a wide window, where the patterns show beside the score as a "Best day" and a "Best time" row. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w1280dp-h1200dp-xhdpi")
class PatternsOverviewTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun bestDaySaysEveryDayIsAboutTheSameWhenEnoughAnswersShowNoDayStandingOut() {
        show(FakeStatsApi(studied = true, dayVerdict = """{"kind":"even","points":4}"""))

        compose.onNodeWithText("You answer about the same every day.").assertExists()
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
