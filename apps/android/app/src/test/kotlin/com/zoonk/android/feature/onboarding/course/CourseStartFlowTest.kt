package com.zoonk.android.feature.onboarding.course

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
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
import com.zoonk.android.feature.catalog.CHAPTER_TWO
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.FakeCatalogApi
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CourseStartFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi().apply { setup = { setupView(listOf("schedule", "plan"), goalId = it) } }
    private lateinit var navigator: AppNavigator
    private var existingGoalId by mutableStateOf<String?>(null)

    private fun show(
        route: AppRoute.CourseStart = AppRoute.CourseStart(COURSE),
        restoration: StateRestorationTester? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { true }
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                CourseStartScreen(route, CatalogStore(FakeCatalogApi(), cache), store, signedIn = true, existingGoalId, navigator)
            }
        }
    }

    private fun refuse(
        resource: String,
        period: String,
    ) {
        api.refusal =
            ApiException(
                ApiError.Unavailable,
                "GOAL_LIMIT_REACHED",
                status = 403,
                details =
                    buildJsonObject {
                        put("period", period)
                        put("resource", resource)
                        put("tier", "free")
                    },
            )
    }

    private fun build() {
        rule.onNodeWithText("Build my plan").performScrollTo().performClick()
        rule.waitForIdle()
    }

    @Test
    fun aWholeCourseAsksTheLevelFirstAndOpensTheSetupItStarts() {
        show()

        rule.onNodeWithText("How much do you already know?").assertIsDisplayed()
        rule.onNodeWithText("Build my plan").assertIsNotEnabled()
        rule.onNodeWithText("The basics").performClick()
        build()

        assertEquals(JsonPrimitive("basic"), api.courseStarts.single().second["level"])
        assertEquals(AppRoute.GoalSetup(GOAL_ID), navigator.currentRoute)
    }

    @Test
    fun aQuickTestStartsWithAnExplicitlyEmptyLevel() {
        show()

        rule.onNodeWithText("Not sure, give me a quick test").performScrollTo().performClick()
        build()

        assertEquals(JsonNull, api.courseStarts.single().second["level"])
        assertEquals(emptyList<Any>(), api.answers)
    }

    @Test
    fun aChapterStartPlansFromThatChapterWithoutAskingTheLevel() {
        show(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO, dailyMinutes = 15))

        rule.onNode(hasText("Bonds") and isHeading()).assertIsDisplayed()
        rule.onNodeWithText("1 chapter · 1 lesson").assertIsDisplayed()
        rule.onNodeWithText("15 minutes a day for now. You can change it in the next steps.").assertIsDisplayed()
        build()

        val body = api.courseStarts.single().second
        assertEquals(JsonPrimitive(CHAPTER_TWO), body["chapterId"])
        assertEquals(JsonPrimitive(15), body["dailyMinutes"])
        assertFalse("level" in body)
    }

    @Test
    fun aLinksTimeOutsideADaysRangeIsLeftForTheSetup() {
        show(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO, dailyMinutes = 1441))

        rule.onNodeWithText("a day for now", substring = true).assertDoesNotExist()
        build()

        assertFalse("dailyMinutes" in api.courseStarts.single().second)
    }

    @Test
    fun aCourseAGoalAlreadyFollowsOpensThatGoalInsteadOfStartingAgain() {
        api.setup = { setupView(listOf("plan"), goalId = it) }
        existingGoalId = GOAL_ID
        show()
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
        assertEquals(emptyList<Any>(), api.courseStarts)
    }

    @Test
    fun aStartInFlightLeadsToItsGoalEvenWhenTheSummaryNamesItFirst() {
        api.courseStartGate = CompletableDeferred()
        val route = AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO)
        show(route)
        rule.runOnIdle { navigator.open(route) }

        build()
        existingGoalId = GOAL_ID
        rule.waitForIdle()
        assertEquals(route, navigator.currentRoute)

        api.courseStartGate?.complete(Unit)
        rule.waitForIdle()
        assertEquals(AppRoute.GoalSetup(GOAL_ID), navigator.currentRoute)
    }

    @Test
    fun aStartInFlightThroughARotationLeadsToItsGoal() {
        api.courseStartGate = CompletableDeferred()
        val restoration = StateRestorationTester(rule)
        val route = AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO)
        show(route, restoration)
        rule.runOnIdle { navigator.open(route) }

        build()
        restoration.emulateSavedInstanceStateRestore()
        api.courseStartGate?.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.GoalSetup(GOAL_ID), navigator.currentRoute)
    }

    @Test
    fun aMonthlyLimitSaysSoAndStillOffersToStart() {
        refuse(resource = "goal", period = "month")
        show(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO))

        build()

        rule.onNodeWithText("Build my plan").performScrollTo().assertIsDisplayed()
        assertEquals(1, api.courseStarts.size)
    }

    @Test
    fun oneActiveGoalOffersPlusInsteadOfStartingUntilTheLearnerLeavesForIt() {
        refuse(resource = "activeGoals", period = "total")
        show(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO))

        build()
        rule.onNodeWithText("Build my plan").assertDoesNotExist()
        rule.onNodeWithText("Go to your Plan").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("See Plus").performScrollTo().performClick()
        assertEquals(AppRoute.Subscription, navigator.currentRoute)

        rule.runOnIdle { navigator.back() }
        rule.onNodeWithText("Build my plan").performScrollTo().assertIsDisplayed()
    }
}
