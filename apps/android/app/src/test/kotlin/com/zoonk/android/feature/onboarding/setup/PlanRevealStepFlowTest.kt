package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.examGoal
import com.zoonk.android.feature.onboarding.feasibilityOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.subjectOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
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
class PlanRevealStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private lateinit var navigator: AppNavigator

    private fun show(
        isGuest: Boolean = false,
        run: GenerationRun = GenerationRun(status = GenerationRun.Status.Following),
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    PlanRevealStep(examGoal(), isGuest, libraryCourse = null, run, onRetryRun = null, store, navigator)
                }
            }
        }
    }

    @Test
    fun theReadyPlanShowsItsShapeAndStartsOnToday() {
        show()

        rule.onNodeWithText("Plan created").assertIsDisplayed()
        rule.onNodeWithText("Pass the bar exam").assertIsDisplayed()
        rule.onNodeWithText("53 days · 30\u00A0min a day").assertIsDisplayed()
        rule.onNodeWithText("Foundations · day 1 of 21").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Final stretch").performScrollTo().assertIsDisplayed()

        navigator.select(AppTab.Plan)
        rule.onNodeWithText("Start").performScrollTo().performClick()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aGuestIsAskedToSaveTheirPlan() {
        show(isGuest = true)

        rule.onNodeWithText("Save your plan so it's here next time.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Create an account").performScrollTo().performClick()

        assertEquals(AppRoute.Login, navigator.currentRoute)
    }

    @Test
    fun timeThatDoesNotCoverTheExamSaysWhatItCovers() {
        api.plan = planOf(feasibility = feasibilityOf(coreFits = true, deepensMostAsked = false))
        api.syllabus = syllabusOf(listOf(subjectOf("Civil", percent = 60), subjectOf("Ethics", percent = 40, assumed = true)))
        show()

        rule
            .onNodeWithText("30\u00A0min a day studies every topic of the exam, some of them in less depth.")
            .performScrollTo()
            .assertIsDisplayed()
        rule.onNodeWithText("Weight by area").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("~ Estimated: the notice doesn't say how much this area weighs.").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aPlanStillBeingBuiltShowsItsWaitUntilARead() {
        api.plan = planOf(ready = false)
        show()

        rule.onNodeWithText("Building your plan").assertIsDisplayed()
        api.plan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun anExamsDocumentsBeingReadShowThatWait() {
        api.plan = planOf(notice = "reading")
        show()

        rule.onNodeWithText("Reading the exam's official documents").assertIsDisplayed()
        rule.onNodeWithText("Reading the official documents").assertIsDisplayed()
    }

    private companion object {
        const val POLL_MILLIS = 3_500L
    }
}
