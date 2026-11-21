package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.isDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
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
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PlacementPart
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.onboarding.orderQuestion
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.plan
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
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

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlacementStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private val planApi = FakePlanApi()
    private var done = 0

    private fun show(inSetup: Boolean = false) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                if (inSetup) {
                    GoalSetupScreen(
                        AppRoute.GoalSetup(GOAL_ID),
                        store,
                        PlanStore(planApi, cache),
                        false,
                        rememberAppNavigator(),
                    )
                } else {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        PlacementStep(
                            GOAL_ID,
                            "bar exam",
                            areaCount = 3,
                            GenerationRun(),
                            onRetryRun = null,
                            store,
                            onProgress = {},
                            onDone = {
                                done++
                                WriteOutcome.Done(Unit)
                            },
                        )
                    }
                }
            }
        }
    }

    private fun tap(text: String) {
        val node = rule.onNodeWithText(text)
        if (!node.isDisplayed()) node.performScrollTo()
        node.performClick()
    }

    @Test
    fun anAnswerThatDidNotGoThroughIsSentAgainAsItWas() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Start")
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        api.writeFailure = null
        tap("Confirm")

        assertEquals(2, api.placementAnswers.size)
        assertEquals(api.placementAnswers[0], api.placementAnswers[1])
        rule.onNodeWithText("Your answers are saved").assertIsDisplayed()
    }

    @Test
    fun aFinishThatFailedKeepsTheLearnerHere() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Skip and start from the basics")

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun startReadsThePlacementFirstSoQuestionsWrittenMeanwhileOpenWithoutTheWait() {
        api.placement = placementOf(status = "preparing", next = null)
        show()
        api.placement = placementOf()
        val read = CompletableDeferred<Unit>()
        api.placementGate = read
        tap("Start")

        rule.onNodeWithText("Getting your test ready").assertDoesNotExist()
        rule.onNodeWithText("Let's see what you already know").assertIsDisplayed()
        rule.onNodeWithText("Start").assertIsNotEnabled()
        rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true).assertExists()

        read.complete(Unit)

        rule.onNodeWithText("Bar exam ·\u00A0Question 1").assertIsDisplayed()
    }

    @Test
    fun aStartWhoseReadFailedWaitsAndReadsAgainInsteadOfOpeningQuestionsReadBefore() {
        show()
        api.placementGate = CompletableDeferred<Unit>().apply { completeExceptionally(ApiException(ApiError.Network)) }
        tap("Start")

        rule.onNodeWithText("Getting your test ready").assertIsDisplayed()
        rule.onNodeWithText("Which court hears appeals from state courts?").assertDoesNotExist()

        api.placementGate = null
        api.placement = placementOf(next = orderQuestion())
        rule.mainClock.advanceTimeBy(POLL_MS)

        rule.onNodeWithText("Put a civil case's stages in order.").assertIsDisplayed()
    }

    @Test
    fun aStopWhoseOnboardingSaveFailsUsesTheQuestionFailureCount() {
        api.setup = { setupView(steps = listOf("placement")) }
        api.reply = { _, _ -> throw ApiException(ApiError.Network) }
        show(inSetup = true)
        tap("Start")
        tap("Stop and use my answers")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
        tap("Stop and use my answers")

        rule.onNodeWithText("Still not going through. You can come back later.").assertIsDisplayed()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
        assertEquals(2, api.answers.size)
        api.reply = { _, _ -> setupView(steps = listOf("plan")) }
        tap("Stop and use my answers")

        assertEquals(3, api.answers.size)
        rule.onNodeWithText("Which court hears appeals from state courts?").assertDoesNotExist()
        rule.onNodeWithText("Still not going through. You can come back later.").assertDoesNotExist()
    }

    @Test
    fun wholeCourseContinuesSetupWithTheFinishedPartsAttempt() {
        val id = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")
        val part = PlacementAttempt(estimatedMinutes = 20, id = id, length = PlacementLength.WHOLE_COURSE, part = 1, partComplete = false)
        api.setup = { setupView(steps = listOf("placement", "plan")) }
        api.reply = { _, _ -> setupView(steps = listOf("plan")) }
        api.sitting = { placementOf(next = orderQuestion()).copy(attempt = part) }
        api.answered = { placementOf(status = "done", next = null, answered = 1).copy(attempt = part) }
        api.completion = completionOf().copy(attempt = part.copy(partComplete = true), lessonsSkipped = 3)
        planApi.shownPlan =
            plan(""" "placementTest":{"kind":"learn","state":"start","estimatedMinutes":20,"attempt":null,"result":null} """)

        show(inSetup = true)
        tap("Whole course")
        tap("Start")
        for (step in listOf("Complaint", "Answer", "Discovery", "Trial")) tap(step)
        tap("Confirm")

        assertEquals(listOf(PlacementPart(id, 1)), api.finishedParts)
        assertEquals(emptyList<Pair<String, OnboardingAnswerInput>>(), api.answers)
        tap("Continue")

        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
        assertEquals(id, answer.value.attemptId)
        assertEquals(listOf(PlacementLength.WHOLE_COURSE), api.sittingLengths)
    }

    @Test
    fun stopStaysBusyUntilItsOnboardingAnswerSettles() {
        api.setup = { setupView(steps = listOf("placement")) }
        val save = CompletableDeferred<Unit>()
        api.answerGate = save
        show(inSetup = true)
        tap("Start")
        tap("The Supreme Court")
        tap("Stop and use my answers")

        rule.onNodeWithText("Stop and use my answers").assertIsNotEnabled()
        rule.onNodeWithText("Confirm").assertIsNotEnabled()
        rule.onNodeWithText("I don't know yet").assertIsNotEnabled()
        rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true).assertExists()
        save.completeExceptionally(ApiException(ApiError.Network))

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
    }

    @Test
    fun aFailedIntroSkipDoesNotCountAsAQuestionFailure() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Skip and start from the basics")
        api.writeFailure = null
        tap("Start")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertDoesNotExist()
        api.writeFailure = ApiException(ApiError.Network)
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("Still not going through. You can come back later.").assertDoesNotExist()
    }

    @Test
    fun aFailedWaitingSkipDoesNotCountAsAQuestionFailure() {
        api.placement = placementOf(status = "preparing", next = null)
        show()
        tap("Start")
        api.writeFailure = ApiException(ApiError.Network)
        rule.mainClock.advanceTimeBy(30_000)
        tap("Skip the test")
        api.writeFailure = null
        api.placement = placementOf()
        rule.mainClock.advanceTimeBy(POLL_MS)

        rule.onNodeWithText("Which court hears appeals from state courts?").assertIsDisplayed()
        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertDoesNotExist()
        api.writeFailure = ApiException(ApiError.Network)
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("Still not going through. You can come back later.").assertDoesNotExist()
    }

    @Test
    fun aWaitingSkipWhoseSaveFailsAfterTheQuestionsOpenStillSaysSo() {
        api.setup = { setupView(steps = listOf("placement")) }
        api.placement = placementOf(status = "preparing", next = null)
        val save = CompletableDeferred<Unit>()
        api.answerGate = save
        show(inSetup = true)
        tap("Start")
        rule.mainClock.advanceTimeBy(30_000)
        tap("Skip the test")
        api.placement = placementOf()
        rule.mainClock.advanceTimeBy(POLL_MS)
        rule.onNodeWithText("Which court hears appeals from state courts?").assertIsDisplayed()
        save.completeExceptionally(ApiException(ApiError.Network))

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertDoesNotExist()
        api.writeFailure = ApiException(ApiError.Network)
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("Still not going through. You can come back later.").assertDoesNotExist()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
    }

    @Test
    fun aWaitingSkipWhoseFinishFailsAfterTheQuestionsOpenStillSaysSo() {
        api.setup = { setupView(steps = listOf("placement")) }
        api.placement = placementOf(status = "preparing", next = null)
        val finish = CompletableDeferred<Unit>()
        api.placementFinishGate = finish
        show(inSetup = true)
        tap("Start")
        rule.mainClock.advanceTimeBy(30_000)
        tap("Skip the test")
        api.placement = placementOf()
        rule.mainClock.advanceTimeBy(POLL_MS)
        rule.onNodeWithText("Which court hears appeals from state courts?").assertIsDisplayed()
        finish.completeExceptionally(ApiException(ApiError.Network))

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertDoesNotExist()
        api.writeFailure = ApiException(ApiError.Network)
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("Still not going through. You can come back later.").assertDoesNotExist()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
    }

    private companion object {
        const val POLL_MS = 3_500L
    }
}
