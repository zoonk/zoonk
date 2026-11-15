package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.SnackbarHost
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.app.rememberWindowSnackbars
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** The Plan's answer after the exam's date saves in the view model, so a failure it reports reaches the window the learner has then. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanExamOverWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<PlanExamOverTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aFailedKeepStudyingShowsInTheWindowRecreatedWhileItSaved() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = PlanExamOverTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val plans = FakePlanApi().apply { gates[PlanOp.FullCourse(true)] = held }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val store = PlanStore(plans, cache)
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val page = PlanPageState(summary.goals.first(), plan(""""status":{"kind":"pastDate","lessons":4}"""), summary)
        PlanExamOverTest.app = AppContainer.preview(application)
        PlanExamOverTest.page = page
        PlanExamOverTest.viewModel = PlanViewModel(store, page.goal.id, PlanExamOverTest.app.writingWaits)
        PlanExamOverTest.farTopics = FarTopicViewModel(store, page.goal.id)
        scenario = ActivityScenario.launch(PlanExamOverTestActivity::class.java)

        rule.onNodeWithText("Keep studying").performClick()
        scenario.recreate()
        plans.changeFailure = ApiException(ApiError.Network)
        held.complete(Unit)

        rule.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
    }
}

/** What outlives [PlanExamOverTestActivity]'s recreations, as the app's container and a navigation entry's view models do. */
object PlanExamOverTest {
    lateinit var app: AppContainer
    lateinit var page: PlanPageState
    lateinit var viewModel: PlanViewModel
    lateinit var farTopics: FarTopicViewModel
}

class PlanExamOverTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                val snackbars = rememberWindowSnackbars(PlanExamOverTest.app)
                val navigator = rememberAppNavigator()

                CompositionLocalProvider(LocalSnackbarHostState provides snackbars) {
                    Box {
                        // As the Plan screen does around its page.
                        VisitOf(PlanExamOverTest.viewModel.visit)
                        PlanEvents(PlanExamOverTest.viewModel, navigator, PlanExamOverTest.app.snackbars)
                        PlanPage(
                            PlanExamOverTest.page,
                            PlanExamOverTest.app,
                            navigator,
                            PlanExamOverTest.viewModel,
                            PlanExamOverTest.farTopics,
                            focus = null,
                        )
                        SnackbarHost(snackbars, Modifier.align(Alignment.BottomCenter))
                    }
                }
            }
        }
    }
}
