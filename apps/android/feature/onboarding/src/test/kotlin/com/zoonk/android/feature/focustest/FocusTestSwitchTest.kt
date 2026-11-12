package com.zoonk.android.feature.focustest

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.onboarding.focusCheckpointOf
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudySessionStore
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FocusTestSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** "Ask a few more in my sessions" on the result opened from the plan. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FocusTestSwitchTest {
    @get:Rule
    val rule = createComposeRule()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @After
    fun tearDown() = scope.cancel()

    @Test
    fun aResultThatAsksNothingMoreHidesTheSwitchTheLearnerChangedOnTheResultBefore() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, scope)
        val checkpoint = focusCheckpointOf(lessonsSkipped = 0, focus = null)
        val api =
            FakeOnboardingApi().apply {
                placement = placementOf(next = null, focusTest = focusTestOf(checkpoint = checkpoint, sessionQuestions = "on"))
                sitting = {
                    placementOf(
                        next = trueFalseQuestion(),
                        focusTest = focusTestOf(sitting = focusSittingOf(questions = 1), offer = null, sessionQuestions = "paused"),
                    )
                }
                answered = {
                    placementOf(
                        status = "done",
                        next = null,
                        answered = 1,
                        complete = true,
                        focusTest =
                            focusTestOf(
                                sitting = focusSittingOf(answered = 1, questions = 1),
                                offer = null,
                                checkpoint = checkpoint,
                                sessionQuestions = "off",
                            ),
                    )
                }
                completion = completionOf(focusTestOf(offer = null, checkpoint = checkpoint, sessionQuestions = "off"))
            }
        val controls =
            FocusTestStore(
                api = { _, _, input ->
                    ApiJson.decodeFromString<FocusTestSummary>(
                        """{"state":"checked","suggestsFocus":true,"offer":null,"sessionQuestions":"${input.sessionQuestions!!.value}"}""",
                    )
                },
                cache = cache,
                sessions = StudySessionStore(FakeStudyApi(), cache) { "UTC" },
                summary = cache.resource(Audience.SignedIn) { null },
                timeZone = { "UTC" },
            )
        val questions = SessionQuestionsModel(controls, UUID.fromString(GOAL_ID))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                SetupColumn {
                    FocusTestFlow(
                        GOAL_ID,
                        "Exam",
                        store,
                        PlanStore(FakePlanApi(), cache),
                        GenerationRun(),
                        null,
                        {},
                        { WriteOutcome.Done(Unit) },
                        plan = OnPlan({}, questions, startOnOpen = false),
                    )
                }
            }
        }

        rule.onNode(isToggleable()).performScrollTo().performClick()
        rule.waitUntil(5_000) { !questions.saving }
        rule.onNode(isToggleable()).assertIsOff()
        rule.onNodeWithText("Answer more questions").performScrollTo().performClick()
        rule.onNodeWithText("True").performScrollTo().performClick()
        rule.onNodeWithText("Confirm").performClick()

        rule.onNodeWithText("Your starting point is set").assertIsDisplayed()
        rule.onAllNodes(isToggleable()).assertCountEquals(0)
    }
}
