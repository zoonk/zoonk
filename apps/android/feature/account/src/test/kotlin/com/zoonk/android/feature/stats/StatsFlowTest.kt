package com.zoonk.android.feature.stats

import androidx.activity.ComponentActivity
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
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
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class StatsFlowTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

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
        rule.onNodeWithText("90%\u00A0· 20 answers").assertIsDisplayed()
    }

    @Test
    fun patternsSayWhatTheApiDecides() {
        val api =
            FakeStatsApi(studied = true).apply {
                verdicts =
                    """"dayVerdict":{"kind":"even","points":3},"minimumAnswers":12,"timeVerdict":{"kind":"notEnough","points":null},""" +
                    """"weekSpread":null"""
            }
        show(StatsPage.Patterns, api = api)

        rule.onNodeWithText("Any day").assertIsDisplayed()
        rule.onNodeWithText("Within 3 points").assertIsDisplayed()
        rule.onNodeWithText("Not enough answers yet").assertIsDisplayed()
        rule
            .onNodeWithText(
                "Your days are within 3 points of each other, so any day works. " +
                    "A day or a time of day needs 12 answers to count, so one lucky answer never makes a pattern.",
            ).assertExists()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun theOverviewSaysTheWeeksSpreadTheApiGives() {
        val api = FakeStatsApi(studied = true).apply { verdicts = verdicts.replace("""{"high":90,"low":60}""", """{"high":95,"low":40}""") }
        show(StatsPage.Overview, api = api)

        rule.onNodeWithText("40%–95%").assertExists()
    }

    /** On an unfolded Galaxy Z Fold, text this large leaves no room for the list: the page keeps to the side before the fold, laid out as a phone's. */
    @Test
    @Config(qualifiers = "w707dp-h823dp", fontScale = 1.5f)
    fun largeTextOnAnOpenBookLaysTheOverviewOutAsAPhones() {
        show(StatsPage.Overview)
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()

        val belt = rule.onNodeWithText("Yellow belt").assertIsDisplayed().getUnclippedBoundsInRoot()
        assertTrue("the overview keeps before the fold: $belt", belt.right <= 353.5.dp)
        rule.onNodeWithText("60%–90%").assertDoesNotExist()
    }

    @Test
    fun theRightTileReadsAsAnswersOutOfAll() {
        show(StatsPage.Score)

        rule
            .onNodeWithText("45 of 60")
            .assertIsDisplayed()
            .assertTextContains("Right")
            .assertTextContains("Of all your answers")
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

        rule.onNodeWithContentDescription("Oct 28\u00A0· 5 activities").assertIsSelected()
        rule.onNodeWithContentDescription("Oct 27\u00A0· 3 activities").performClick().assertIsSelected()
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
