package com.zoonk.android.feature.stats

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserEnergyResponseEnergy
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class StatsFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator

    private fun show(
        page: StatsPage,
        studied: Boolean = true,
    ) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val session = remember { FakeSession(AuthenticatedSession("account", "token", "local")) }
                val stats =
                    remember {
                        StatsStore(
                            FakeStatsApi(studied),
                            AppCache(
                                session,
                                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                            ),
                        )
                    }
                navigator = rememberAppNavigator()
                StatsScreen(page, app, navigator, stats)
            }
        }
    }

    @Test
    fun theOverviewSaysEachNumberAndOpensItsPage() {
        show(StatsPage.Overview)

        rule.onNodeWithText("Yellow belt").assertIsDisplayed()
        rule.onNodeWithText("Average 58%").assertIsDisplayed()
        rule.onNodeWithText("45/60 right").assertIsDisplayed()
        rule.onNodeWithText("Average 58%").performClick()

        assertEquals(AppRoute.StatsEnergy, navigator.currentRoute)
    }

    @Test
    fun aLearnerWhoHasntStudiedIsSentToToday() {
        show(StatsPage.Overview, studied = false)

        rule.onNodeWithText("Start learning to track your progress").assertIsDisplayed()
    }

    @Test
    fun patternsNameTheBestDay() {
        show(StatsPage.Patterns)

        rule.onAllNodesWithText("Tuesday")[0].assertIsDisplayed()
        rule.onNodeWithText("90% · 20 answers").assertIsDisplayed()
    }

    @Test
    fun theTabsMoveBetweenPages() {
        show(StatsPage.Level)

        rule.onNodeWithText("40 Brain Power").assertIsDisplayed()
        rule.onNodeWithText("Score").performClick()

        assertEquals(AppRoute.StatsScore, navigator.currentRoute)
    }
}
