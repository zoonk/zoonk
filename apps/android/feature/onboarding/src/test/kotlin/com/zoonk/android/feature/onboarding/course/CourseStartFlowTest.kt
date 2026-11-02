package com.zoonk.android.feature.onboarding.course

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonNull
import org.junit.Assert.assertEquals
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
    private val catalog = FakeCatalogApi()
    private lateinit var navigator: AppNavigator
    private var existingGoalId by mutableStateOf<String?>(null)

    private fun show(
        route: AppRoute.CourseStart = AppRoute.CourseStart(COURSE),
        restoration: StateRestorationTester? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
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

    private fun build() {
        rule.onNodeWithText("Build my plan").performScrollTo().performClick()
        rule.waitForIdle()
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
