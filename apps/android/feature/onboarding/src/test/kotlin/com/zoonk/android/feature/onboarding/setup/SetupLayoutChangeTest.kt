package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.EXAM_GOAL_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.adviceOf
import com.zoonk.android.feature.onboarding.coverOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewOptionsInner
import com.zoonk.api.models.ProfileQuestionViewSaved
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * A width change, a fold or split screen redraws the setup screen: what a tap started and what follows it are the
 * screen's, so they arrive once whatever the layout does meanwhile.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SetupLayoutChangeTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private val planApi = FakePlanApi().apply { shownPlan = planOf() }
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val session = FakeSession(ana)
    private val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    private var layout by mutableIntStateOf(0)
    private lateinit var navigator: AppNavigator

    @Test
    fun saveAndStartOpensTheLessonOnceThoughTheLayoutChangesWhileItSaves() {
        val form =
            ProfileQuestionView(
                ProfileQuestion.ADDRESS_FORM,
                listOf(
                    ProfileQuestionViewOptionsInner(null, "neutral", "Neutral"),
                    ProfileQuestionViewOptionsInner(null, "feminine", "Feminine"),
                ),
                ProfileQuestionViewSaved(emptyList(), emptyList(), ""),
                null,
                1,
            )
        val lesson = """{"id":"$LESSON","status":"ready","title":"Dawn songs"}"""
        api.setup =
            {
                setupView(
                    listOf("addressForm", "plan"),
                    firstLesson = lesson,
                ).let { it.copy(profile = it.profile.copy(questions = listOf(form))) }
            }
        show()
        rule.onNodeWithText("Neutral").performClick()
        val held = CompletableDeferred<Unit>()
        api.answerGate = held

        rule.onNodeWithText("Save and start lesson 1").performClick()
        rule.waitForIdle()
        layout++
        rule.waitForIdle()
        layout++
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Lesson(LESSON), navigator.currentRoute)
    }

    private fun show() {
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val plans = PlanStore(planApi, cache)
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                // Each layout change composes the screen anew, as a resize does; the view model outlives it.
                key(layout) { GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), store, plans, isGuest = false, navigator) }
            }
        }
        rule.waitForIdle()
    }

    private companion object {
        const val LESSON = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1aaa"
    }
}
