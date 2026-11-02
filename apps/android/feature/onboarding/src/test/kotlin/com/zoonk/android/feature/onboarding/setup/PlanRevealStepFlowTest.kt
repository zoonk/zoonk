package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.examGoal
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanRevealStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val planApi =
        FakePlanApi().apply {
            shownPlan = planOf()
            shownSyllabus = syllabusOf(emptyList(), kind = "modules")
        }
    private lateinit var navigator: AppNavigator

    private fun show(
        prepareToday: suspend () -> Unit = {},
        restoration: StateRestorationTester? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val plans = PlanStore(planApi, cache)
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    PlanRevealStep(
                        examGoal(),
                        isGuest = false,
                        libraryCourse = null,
                        GenerationRun(status = GenerationRun.Status.Following),
                        onRetryRun = null,
                        plans,
                        navigator,
                        SETUP,
                        prepareToday,
                    )
                }
            }
        }
    }

    @Test
    fun startWaitsForTodayAndShowsItIsWorkingWhileTodayLoads() {
        val today = CompletableDeferred<Unit>()
        show(prepareToday = { today.await() })
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(500)

        assertNotEquals(AppRoute.Today, navigator.currentRoute)
        rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertIsDisplayed()

        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aStartStillWaitingOnTodayOpensItAfterTheScreenIsRebuilt() {
        val today = CompletableDeferred<Unit>()
        val restoration = StateRestorationTester(rule)
        show(prepareToday = { today.await() }, restoration = restoration)
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(100)
        restoration.emulateSavedInstanceStateRestore()
        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun goingBackWhileTodayLoadsKeepsTheLearnerWhereBackWent() {
        val today = CompletableDeferred<Unit>()
        show(prepareToday = { today.await() })
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        navigator.back()
        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Plan(), navigator.currentRoute)
    }

    @Test
    fun aPlanStillBeingBuiltShowsItsWaitUntilARead() {
        planApi.shownPlan = planOf(ready = false)
        show()

        rule.onNodeWithText("Building your plan").assertIsDisplayed()
        planApi.shownPlan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun anExamsDocumentsKeepBeingWaitedForPastTenMinutes() {
        planApi.shownPlan = planOf(notice = "reading")
        show()
        rule.mainClock.advanceTimeBy(ELEVEN_MINUTES)

        planApi.shownPlan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun readsThatKeepFailingWhileTheDocumentsAreReadOfferToReconnect() {
        planApi.shownPlan = planOf(notice = "reading")
        show()
        rule.onNodeWithText("Reading the exam's official documents").assertIsDisplayed()

        planApi.planFailure = ApiException(ApiError.Network)
        rule.mainClock.advanceTimeBy(POLL_MILLIS * 3)
        rule.onNodeWithText("Connection lost").assertIsDisplayed()
        planApi.planFailure = null
        planApi.shownPlan = planOf()
        rule.onNodeWithText("Reconnect").performScrollTo().performClick()
        rule.mainClock.advanceTimeByFrame()

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    private companion object {
        const val POLL_MILLIS = 3_500L
        const val ELEVEN_MINUTES = 11 * 60_000L
        val SETUP = AppRoute.GoalSetup(GOAL_ID)
    }
}
