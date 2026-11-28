package com.zoonk.android.feature.onboarding.setup

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.isDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
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
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.onboarding.orderQuestion
import com.zoonk.android.feature.onboarding.placementAttemptOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.placementResultOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.PlacementAnswerInput
import com.zoonk.api.models.PlacementAnswerResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/**
 * Onboarding's course test, as the server's `placement` sets it up: its offer, a start the learner asked for, the ways
 * out behind ✕, and its result.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlacementStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()

    private fun show(
        mode: String = "offer",
        through: OnboardingApi = api,
    ) {
        api.setup = { setupView(steps = listOf("placement", "plan"), placement = placementView(mode)) }
        api.reply = { _, _ -> setupView(steps = listOf("plan")) }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(through, cache, session) { SignInResult.SignedIn }
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

    /** The test's open at its question [number]; [answered] questions are behind it. */
    private fun asking(answered: Long) = placementOf(next = orderQuestion()).copy(attempt = placementAttemptOf(answered = answered))

    @Test
    fun theOfferStartsTheTestUnderItsChapterAtItsFirstQuestion() {
        api.placement = placementOf(next = null, status = "done")
        api.sitting = { asking(0) }
        show()

        rule.onNodeWithText("Where would you like to start?").assertIsDisplayed()
        rule.onNodeWithText("Up to 8 questions").assertIsDisplayed()
        tap("Start")

        assertEquals(1, api.sittingsStarted)
        rule.onNodeWithText("Civil procedure").assertIsDisplayed()
        rule.onNodeWithContentDescription("Question 1 of 8").assertIsDisplayed()
    }

    @Test
    fun aLearnerWhoAskedForTheTestStartsItWithoutTheOffer() {
        api.placement = placementOf(next = null, status = "done")
        api.sitting = { asking(0) }
        show(mode = "direct")

        rule.onNodeWithContentDescription("Question 1 of 8").assertIsDisplayed()
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

        assertEquals(listOf<UUID?>(null), api.finishedAttempts)
        assertEquals(0, api.sittingsStarted)
        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
        assertEquals(null, answer.value.attemptId)
    }

    @Test
    fun beforeAnyAnswerTheCloseLeavesWithoutAskingHowToStop() {
        api.placement = asking(0)
        show(mode = "resume")
        rule.onNodeWithContentDescription("Question 1 of 8").assertIsDisplayed()

        rule.onNodeWithContentDescription("Leave").performClick()

        rule.onNodeWithText("Stop and use my answers").assertDoesNotExist()
        rule.onNodeWithText("Finish later").assertDoesNotExist()
    }

    @Test
    fun withAnswersTheCloseOffersToStopAndStoppingShowsWhereTheLearnerStarts() {
        api.placement = asking(1)
        api.completion = completionOf().copy(lessonsSkipped = 4, result = placementResultOf())
        show(mode = "resume")
        rule.onNodeWithContentDescription("Question 2 of 8").assertIsDisplayed()

        rule.onNodeWithContentDescription("Leave").performClick()
        rule.onNodeWithText("Finish later").assertIsDisplayed()
        tap("Stop and use my answers")
        rule.waitUntil(WAIT_MS) { api.finishedAttempts.isNotEmpty() }

        assertEquals(listOf<UUID?>(ID), api.finishedAttempts)
        assertEquals(listOf<Long?>(1), api.finishedAnswered)
        rule.onNodeWithText("You start here").assertIsDisplayed()
        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithContentDescription("4 of 9 lessons skipped").assertIsDisplayed()
        rule.onNodeWithText("News, results and expectations").assertIsDisplayed()
        rule.onNodeWithText("Undo").assertIsDisplayed()
        tap("Continue")
        rule.waitUntil(WAIT_MS) { api.answers.isNotEmpty() }

        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
        assertEquals(ID, answer.value.attemptId)
    }

    @Test
    fun whileAnAnswerSavesTheWaysOutCannotStopUntilItSettles() {
        val reply = CompletableDeferred<Unit>()
        val gated =
            object : OnboardingApi by api {
                override suspend fun answerPlacement(
                    session: AuthenticatedSession,
                    goalId: String,
                    input: PlacementAnswerInput,
                ): PlacementAnswerResult {
                    reply.await()
                    return api.answerPlacement(session, goalId, input)
                }
            }
        api.placement = asking(1)
        api.answered = { asking(2) }
        show(mode = "resume", through = gated)
        tap("Confirm")

        rule.onNodeWithContentDescription("Leave").performClick()
        rule.onNodeWithText("Stop and use my answers").assertIsNotEnabled()
        rule.onNodeWithText("Finish later").assertIsEnabled()

        reply.complete(Unit)
        rule.waitForIdle()
        rule.onNodeWithText("Stop and use my answers").assertIsEnabled()
    }

    @Test
    fun aResultFromBeforeThePlanSaysOnlyWhereTheLearnerStarts() {
        api.placement = placementOf(status = "done", next = null).copy(attempt = placementAttemptOf(answered = 7))
        api.completion = completionOf().copy(result = placementResultOf(lessonsSkipped = 0, course = null, changeId = null))
        show(mode = "resume")
        tap("Continue")
        rule.waitUntil(WAIT_MS) { api.finishedAttempts.isNotEmpty() }

        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithText("News, results and expectations").assertDoesNotExist()
        rule.onNodeWithText("Undo").assertDoesNotExist()
    }

    private companion object {
        const val WAIT_MS = 5_000L
        val ID: UUID = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")

        fun placementView(mode: String) = """{"mode":"$mode","test":{"kind":"course","offer":{"estimatedMinutes":4,"questions":8}}}"""
    }
}
