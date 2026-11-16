package com.zoonk.android.app.shell

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryWaitingGoal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class GoalSwitcherWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    @Test
    fun aStartCompletedBetweenWindowsOpensSetupAfterItsWaitingRowDisappears() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = GoalSwitcherTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val gate = CompletableDeferred<Unit>()
        val api = FakeOnboardingApi().apply { createGate = gate }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, scope), session) { SignInResult.SignedIn }
        val app = AppContainer.preview(application)
        val waiting =
            ApiJson.decodeFromString<LearnerSummaryWaitingGoal>(
                """
                {"displayName":"Bar exam","id":"waiting-1","languageFlag":null,"locked":true,
                 "input":{"dailyMinutes":15,"goals":[{"kind":"exam","language":"en","prompt":"pass the bar exam","title":"Bar exam"}]}}
                """.trimIndent(),
            )
        app.learnerSummary.summary.replace(learnerSummary().copy(waitingGoals = listOf(waiting)))
        GoalSwitcherWindow.app = app
        GoalSwitcherWindow.model = GoalSwitcherViewModel(app, store)
        val scenario = ActivityScenario.launch(GoalSwitcherTestActivity::class.java)
        try {
            scenario.onActivity { it.compose() }
            rule.onNodeWithContentDescription("Learn Python, current goal. Switch goal").performClick()
            rule.onNodeWithText("Bar exam").performClick()
            rule.onNodeWithContentDescription("Pause Learn Python").performClick()
            rule.waitForIdle()

            assertEquals(learnerSummary().goals.first().id, GoalSwitcherWindow.model.pausing)
            val opening = GoalSwitcherWindow.model.makeRoomSheet.number
            RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
            scenario.recreate()
            // The write and summary refresh land before the new window composes its restored sheet.
            gate.complete(Unit)
            rule.waitForIdle()
            shadowOf(android.os.Looper.getMainLooper()).idle()
            assertEquals(opening, GoalSwitcherWindow.model.makeRoomSheet.number)
            assertEquals(GOAL_ID, GoalSwitcherWindow.model.startedFromSheet.value)
            app.learnerSummary.summary.replace(learnerSummary())
            scenario.onActivity { it.compose() }
            rule.waitForIdle()

            assertEquals(AppRoute.GoalSetup(GOAL_ID), GoalSwitcherWindow.navigator.currentRoute)
            assertNull(GoalSwitcherWindow.model.startedFromSheet.value)
            GoalSwitcherWindow.navigator.back()
            rule.waitForIdle()
            RuntimeEnvironment.setQualifiers("w411dp-h891dp")
            scenario.recreate()
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            assertEquals(AppRoute.Today, GoalSwitcherWindow.navigator.currentRoute)
        } finally {
            scenario.close()
            scope.cancel()
        }
    }
}

object GoalSwitcherWindow {
    lateinit var app: AppContainer
    lateinit var model: GoalSwitcherViewModel
    lateinit var navigator: AppNavigator
}

class GoalSwitcherTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) {
            viewModelStore.put(
                "androidx.lifecycle.ViewModelProvider.DefaultKey:${GoalSwitcherViewModel::class.java.name}",
                GoalSwitcherWindow.model,
            )
        }
    }

    fun compose() {
        setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                GoalSwitcherWindow.navigator = navigator
                GoalSwitcher(GoalSwitcherWindow.app, navigator)
            }
        }
    }
}
