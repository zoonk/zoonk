package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.ui.format.FACT_SEPARATOR
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.isDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PlacementPart
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.onboarding.orderQuestion
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** Onboarding's course test, as the server's `placement` sets it up: its offer, a start the learner asked for, and its ways on. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlacementStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()

    private fun show(mode: String = "offer") {
        api.setup = { setupView(steps = listOf("placement", "plan"), placement = placementView(mode)) }
        api.reply = { _, _ -> setupView(steps = listOf("plan")) }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), store, PlanStore(FakePlanApi(), cache), false, rememberAppNavigator())
            }
        }
    }

    private fun tap(text: String) {
        val node = rule.onNodeWithText(text)
        if (!node.isDisplayed()) node.performScrollTo()
        node.performClick()
    }

    @Test
    fun theOfferStartsTheQuickTestAtItsFirstQuestionOfTwelve() {
        api.placement = placementOf(next = null, status = "done")
        api.sitting = { placementOf(next = orderQuestion()).copy(attempt = attempt(PlacementLength.QUICK)) }
        show()

        rule.onNodeWithText("Where would you like to start?").assertIsDisplayed()
        rule.onNodeWithText("Full test").assertIsDisplayed()
        tap("Start")

        assertEquals(listOf<PlacementLength?>(PlacementLength.QUICK), api.sittingLengths)
        rule.onNodeWithText("Question 1 of 12").assertIsDisplayed()
    }

    @Test
    fun aLearnerWhoAskedForTheTestStartsItWithoutTheOffer() {
        api.placement = placementOf(next = null, status = "done")
        api.sitting = { placementOf(next = orderQuestion()).copy(attempt = attempt(PlacementLength.QUICK)) }
        show(mode = "direct")

        rule.onNodeWithText("Question 1 of 12").assertIsDisplayed()
        rule.onNodeWithText("Where would you like to start?").assertDoesNotExist()
        assertEquals(1, api.sittingsStarted)
    }

    @Test
    fun firstLessonStartsFromScratchAndGoesOnWithoutATest() {
        api.placement = placementOf(next = null, status = "done")
        show()
        tap("First lesson")
        tap("Continue")
        rule.waitUntil(WAIT_MS) { api.answers.isNotEmpty() }

        assertEquals(listOf<PlacementPart?>(null), api.finishedParts)
        assertEquals(0, api.sittingsStarted)
        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
        assertEquals(null, answer.value.attemptId)
    }

    @Test
    fun theFullTestsCheckpointFinishesLaterWithItsAttempt() {
        val part = attempt(PlacementLength.WHOLE_COURSE)
        api.placement = placementOf(next = null, status = "done")
        api.sitting = { placementOf(next = orderQuestion()).copy(attempt = part) }
        api.answered = { placementOf(status = "done", next = null, answered = 1).copy(attempt = part) }
        api.completion = completionOf().copy(attempt = part.copy(partComplete = true, partsLeft = 1, nextPart = 2), lessonsSkipped = 3)
        show()
        tap("Full test")
        tap("Start")
        rule.onNodeWithText("Part 1 of 2${FACT_SEPARATOR}Question 1 of 12").assertIsDisplayed()
        tap("Confirm")

        assertEquals(listOf<PlacementPart?>(PlacementPart(ID, 1)), api.finishedParts)
        rule.onNodeWithText("Part 1 of 2 done").assertIsDisplayed()
        tap("Finish later")
        rule.waitUntil(WAIT_MS) { api.answers.isNotEmpty() }

        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
        assertEquals(ID, answer.value.attemptId)
    }

    private companion object {
        const val WAIT_MS = 5_000L
        val ID: UUID = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")

        fun attempt(length: PlacementLength) =
            PlacementAttempt(
                answered = 0,
                chapter = "Variables",
                estimatedMinutes = 6,
                id = ID,
                length = length,
                nextPart = null,
                part = 1,
                partComplete = false,
                parts = 2,
                partsLeft = 2,
                questions = 12,
                remainingEstimatedMinutes = 12,
                resume = null,
                totalEstimatedMinutes = 12,
            )

        fun placementView(mode: String) =
            """{"mode":"$mode","test":{"kind":"course","offer":{"estimatedMinutes":6,"questions":12,"wholeCourse":{"estimatedMinutes":12,"parts":2}}}}"""
    }
}
