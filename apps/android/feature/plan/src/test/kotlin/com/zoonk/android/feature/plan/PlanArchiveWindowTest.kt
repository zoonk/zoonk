package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearnerSummaryGoal
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
class PlanArchiveWindowTest {
    @get:Rule val rule: ComposeTestRule = createEmptyComposeRule()

    @Test
    fun anArchiveCompletedBetweenWindowsLeavesPlanAfterItsGoalDisappears() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = PlanArchiveTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val held = CompletableDeferred<Unit>()
        val api = FakePlanApi().apply { statusGate = held }
        val summary = learnerSummary()
        val goal = summary.goals.first()
        val app = AppContainer.preview(application)
        app.learnerSummary.summary.replace(summary)
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope)
        val navigation = PlanNavigationModel()
        val model = PlanViewModel(PlanStore(api, cache), goal.id, app.writingWaits, navigation)
        PlanArchiveWindow.app = app
        val scenario = ActivityScenario.launch(PlanArchiveTestActivity::class.java)
        try {
            scenario.onActivity {
                it.viewModelStore.put("androidx.lifecycle.ViewModelProvider.DefaultKey:${PlanNavigationModel::class.java.name}", navigation)
                it.viewModelStore.put("plan-${goal.id}", model)
                it.compose()
            }
            rule.waitForIdle()
            scenario.onActivity { model.setStatus(LearnerSummaryGoal.Status.ARCHIVED) }
            RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
            scenario.recreate()
            held.complete(Unit)
            shadowOf(android.os.Looper.getMainLooper()).idle()
            app.learnerSummary.summary.replace(summary.copy(goals = emptyList()))
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            assertEquals(AppTab.Today, PlanArchiveWindow.navigator.selectedTab)
            assertNull(model.event.value)
            RuntimeEnvironment.setQualifiers("w411dp-h891dp")
            scenario.recreate()
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            assertEquals(AppTab.Today, PlanArchiveWindow.navigator.selectedTab)
        } finally {
            scenario.close()
            scope.cancel()
        }
    }
}

object PlanArchiveWindow {
    lateinit var app: AppContainer
    lateinit var navigator: AppNavigator
}

class PlanArchiveTestActivity : ComponentActivity() {
    fun compose() {
        setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                PlanArchiveWindow.navigator = navigator
                val started =
                    androidx.compose.runtime.saveable
                        .rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    if (!started.value) {
                        navigator.select(AppTab.Plan)
                        started.value = true
                    }
                }
                if (navigator.selectedTab == AppTab.Plan) PlanScreen(PlanArchiveWindow.app, navigator)
            }
        }
    }
}
