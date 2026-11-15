package com.zoonk.android.feature.onboarding.setup

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewOptionsInner
import com.zoonk.api.models.ProfileQuestionViewSaved
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * "Save and start lesson 1" belongs to the visit that tapped it: a width change, a fold or a rotation while it saves
 * is the same visit, so the lesson opens once; leaving the setup before it saves means the save opens nothing.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SetupLayoutChangeTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<SetupTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun saveAndStartOpensTheLessonOnceThoughTheWindowWidensAndNarrowsWhileItSaves() {
        val held = startSaving()

        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Lesson(LESSON), SetupTest.navigator.currentRoute)
    }

    @Test
    fun saveAndStartThatSavesAfterTheLearnerLeftOpensNothingOnTheirReturn() {
        val held = startSaving()

        SetupTest.visible = false
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()
        SetupTest.visible = true
        rule.waitForIdle()

        assertEquals(AppRoute.Today, SetupTest.navigator.currentRoute)
    }

    /** The setup's profile step, its form answered and "Save and start lesson 1" tapped, the save held until completed. */
    private fun startSaving(): CompletableDeferred<Unit> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = SetupTestActivity::class.java.name
                packageName = application.packageName
            },
        )
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
        val api =
            FakeOnboardingApi().apply {
                setup = {
                    setupView(listOf("addressForm", "plan"), firstLesson = lesson).let {
                        it.copy(profile = it.profile.copy(questions = listOf(form)))
                    }
                }
            }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        SetupTest.visible = true
        SetupTest.store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        SetupTest.plans = PlanStore(FakePlanApi().apply { shownPlan = planOf() }, cache)
        scenario = ActivityScenario.launch(SetupTestActivity::class.java)

        rule.onNodeWithText("Neutral").performClick()
        val held = CompletableDeferred<Unit>()
        api.answerGate = held
        rule.onNodeWithText("Save and start lesson 1").performClick()
        rule.waitForIdle()
        return held
    }

    private companion object {
        const val LESSON = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1aaa"
    }
}

/** What outlives [SetupTestActivity]'s recreations, as the app's container does. */
object SetupTest {
    /** False while the learner is away from the setup, its view model kept, as a screen over it keeps it. */
    var visible by mutableStateOf(true)
    lateinit var store: OnboardingStore
    lateinit var plans: PlanStore
    lateinit var navigator: AppNavigator
}

class SetupTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                SetupTest.navigator = rememberAppNavigator()
                if (SetupTest.visible) {
                    GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), SetupTest.store, SetupTest.plans, isGuest = false, SetupTest.navigator)
                }
            }
        }
    }
}
