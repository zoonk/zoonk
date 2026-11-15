package com.zoonk.android.feature.onboarding.course

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.catalog.CHAPTER_TWO
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.FakeCatalogApi
import com.zoonk.android.feature.catalog.course
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.noAllowance
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.Instant

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CourseStartFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi().apply { setup = { setupView(listOf("schedule", "plan"), goalId = it) } }
    private val catalog = FakeCatalogApi()
    private lateinit var navigator: AppNavigator
    private var existingGoalId by mutableStateOf<String?>(null)
    private val clock by lazy { TestClock(rule.mainClock) }

    private fun show(
        route: AppRoute.CourseStart = AppRoute.CourseStart(COURSE),
        restoration: StateRestorationTester? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    navigator = rememberAppNavigator()
                    CourseStartScreen(
                        route,
                        CatalogStore(catalog, cache),
                        store,
                        cache.noAllowance(),
                        signedIn = true,
                        existingGoalId,
                        navigator,
                    )
                }
            }
        }
    }

    private fun build() {
        rule.onNodeWithText("Build my plan").performClick()
        rule.waitForIdle()
    }

    /** As on main: the month's goals cap takes Build my plan's place and the level choices, and both come back on its day. */
    @Test
    fun aMonthlyGoalsCapTakesBuildMyPlansPlaceUntilItsDayComes() {
        api.refusal = ApiException(ApiError.Unavailable, "GOAL_LIMIT_REACHED", status = 429, details = monthlyGoalsLimit(clock.opening))
        show()

        rule.onNodeWithText(QUICK_TEST).performScrollTo().performClick()
        build()

        rule.onNodeWithText("Build my plan").assertDoesNotExist()
        rule.onNodeWithText(QUICK_TEST).assertDoesNotExist()
        rule.onNodeWithText("Subscribe").assertExists()

        api.refusal = null
        clock.passOpening()
        rule.waitUntil(10_000) { rule.onAllNodesWithText("Build my plan").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        rule.onNodeWithText(QUICK_TEST).assertExists()
    }

    @Test
    fun aQuickTestStartsWithAnExplicitlyEmptyLevel() {
        show()

        rule.onNodeWithText(QUICK_TEST).performScrollTo().performClick()
        build()

        assertEquals(JsonNull, api.courseStarts.single().second["level"])
        assertEquals(emptyList<Any>(), api.answers)
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
}

private const val QUICK_TEST = "Not sure, give me a quick test"

private fun monthlyGoalsLimit(availableAt: Instant) =
    buildJsonObject {
        put("availableAt", availableAt.toString())
        put("period", "rolling30Days")
        put("resource", "goal")
        put("tier", "free")
    }
