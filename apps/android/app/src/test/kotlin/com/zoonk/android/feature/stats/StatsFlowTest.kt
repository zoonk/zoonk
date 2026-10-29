package com.zoonk.android.feature.stats

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
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
        api: FakeStatsApi = FakeStatsApi(studied),
    ) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val session = remember { FakeSession(AuthenticatedSession("account", "token", "local")) }
                val stats =
                    remember {
                        StatsStore(
                            api,
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
        rule.onNodeWithText("Average 58.3%").assertIsDisplayed()
        rule.onNodeWithText("45/60 right").assertIsDisplayed()
        rule.onNodeWithText("Average 58.3%").performClick()

        assertEquals(AppRoute.StatsEnergy, navigator.currentRoute)
    }

    @Test
    fun aLearnerWhoHasntStudiedIsSentToToday() {
        show(StatsPage.Overview, studied = false)

        rule.onNodeWithText("Start learning to track your progress").assertIsDisplayed()
        rule.runOnIdle { navigator.open(AppRoute.Statistics) }
        rule.onNodeWithText("Go to Today").performClick()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aPartThatFailedLoadsAgainOnRetry() {
        val api = FakeStatsApi(studied = true).apply { activityFails = true }
        show(StatsPage.Overview, api = api)

        rule.onNodeWithText("We couldn't load this part.").assertIsDisplayed()
        rule.onNodeWithText("Yellow belt").assertIsDisplayed()

        api.activityFails = false
        rule.onNodeWithText("Try again").performClick()

        rule.onNodeWithText("Past 12 months").assertExists()
        rule.onAllNodesWithText("We couldn't load this part.").assertCountEquals(0)
    }

    @Test
    fun patternsNameTheBestDay() {
        show(StatsPage.Patterns)

        rule.onAllNodesWithText("Tuesday")[0].assertIsDisplayed()
        rule.onNodeWithText("90% · 20 answers").assertIsDisplayed()
    }

    @Test
    fun theLevelPageSaysHowFarTheNextBeltIs() {
        show(StatsPage.Level)

        rule.onNodeWithText("40 Brain Power").assertIsDisplayed()
        rule.onNodeWithText("740 to go").assertExists()
    }

    @Test
    fun aTappedDayIsTheOneTheCalendarSays() {
        show(StatsPage.Activity)

        rule.onNodeWithContentDescription("Oct 28 · 5 activities").assertIsSelected()
        rule.onNodeWithContentDescription("Oct 27 · 3 activities").performClick().assertIsSelected()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun aPageOpenedFromElsewhereIsSwappedInPlace() {
        show(StatsPage.Score)
        rule.runOnIdle { navigator.open(AppRoute.StatsScore) }

        rule.onNodeWithText("Energy").performClick()
        assertEquals(AppRoute.StatsEnergy, navigator.currentRoute)

        rule.runOnIdle { navigator.back() }
        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun theListBesideSwapsPagesSoBackLeavesTheSection() {
        show(StatsPage.Level)
        rule.runOnIdle {
            navigator.open(AppRoute.Statistics)
            navigator.open(AppRoute.StatsLevel)
        }

        rule.onNodeWithText("Score").performClick()
        assertEquals(AppRoute.StatsScore, navigator.currentRoute)

        rule.runOnIdle { navigator.back() }
        assertEquals(AppRoute.Statistics, navigator.currentRoute)
    }
}
