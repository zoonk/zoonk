package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** The coverage suggestion's search is asked from its card, at every width, which is what its answer belongs to. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CoverageCardWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private val api = FakePlanApi()
    private val held = CompletableDeferred<Unit>().also { api.timeToCoverGate = it }
    private lateinit var scenario: ActivityScenario<CoverageCardTestActivity>

    @Before
    fun open() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CoverageCardTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val summary = learnerSummary()
        val plan = coveragePlan().also { api.shownPlan = it }
        val page = PlanPageState(summary.goals.first(), plan, summary)
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val store = PlanStore(api, cache)
        runBlocking { store.plan[page.goal.id].refresh() }
        CoverageCardTest.page = page
        CoverageCardTest.shown.value = true
        CoverageCardTest.viewModel =
            PlanViewModel(
                store,
                page.goal.id,
                writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")),
                PlanNavigationModel(GoalSwitch { true }),
            )
        scenario = ActivityScenario.launch(CoverageCardTestActivity::class.java)
        rule.onNodeWithText("See what changes").performClick()
    }

    @After
    fun close() = scenario.close()

    @Test
    fun aSearchThatAnswersAfterItsCardLeftAsksNoPreviewWhenItShowsAgain() {
        CoverageCardTest.shown.value = false
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()

        CoverageCardTest.shown.value = true
        rule.waitForIdle()

        assertTrue(CoverageCardTest.viewModel.timeToCover.value is TimeToCoverState.Answered)
        assertEquals(PlanPreviewState.Idle, CoverageCardTest.viewModel.slotPreview.value)
    }

    @Test
    fun aSearchThatAnswersWhileTheCardIsRecreatedAtAnotherWidthAsksItsPreviewOnce() {
        rule.waitForIdle()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertNotNull((CoverageCardTest.viewModel.slotPreview.value as? PlanPreviewState.Asked))
        assertNull(CoverageCardTest.viewModel.outcomes.coverageFound.value)
    }
}

/** What outlives [CoverageCardTestActivity]'s recreations, as a navigation entry's view models do. */
object CoverageCardTest {
    val shown = mutableStateOf(true)

    lateinit var page: PlanPageState
    lateinit var viewModel: PlanViewModel
}

class CoverageCardTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = CoverageCardTest.page
        val viewModel = CoverageCardTest.viewModel
        setContent {
            ZoonkTheme {
                val timeToCover by viewModel.timeToCover.collectAsState()
                val preview by viewModel.slotPreview.collectAsState()
                val navigator = rememberAppNavigator()
                VisitOf(viewModel.visit)
                Column {
                    if (CoverageCardTest.shown.value) {
                        CoverageSuggestion(
                            Slot(
                                page,
                                PlanEdits(
                                    timeToCover = timeToCover,
                                    findTimeToCover = viewModel::findTimeToCover,
                                    outcomes = viewModel.outcomes,
                                ),
                                PlanLinks(navigator, page),
                                SlotHost(
                                    preview = preview,
                                    requestPreview = { viewModel.requestSlotPreview(page.plan, it) },
                                    clearPreview = viewModel::clearSlotPreview,
                                ),
                                viewModel.slotState,
                                if (with(LocalDensity.current) {
                                        LocalWindowInfo.current.containerSize.width
                                            .toDp()
                                    } > 900.dp
                                ) {
                                    SuggestionLayout.Panel
                                } else {
                                    SuggestionLayout.Line
                                },
                                SlotFocus(),
                            ),
                        )
                    }
                }
            }
        }
    }
}
