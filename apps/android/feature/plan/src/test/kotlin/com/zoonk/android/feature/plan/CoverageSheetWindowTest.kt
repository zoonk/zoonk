package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
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

/** On a phone the coverage suggestion's search is asked from its sheet, which is what its answer belongs to. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CoverageSheetWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    @get:Rule val testName = org.junit.rules.TestName()

    private val api = FakePlanApi()
    private val held = CompletableDeferred<Unit>().also { api.timeToCoverGate = it }
    private lateinit var scenario: ActivityScenario<CoverageSheetTestActivity>

    @Before
    fun open() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CoverageSheetTestActivity::class.java.name
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
        CoverageSheetTest.page = page
        CoverageSheetTest.viewModel =
            PlanViewModel(store, page.goal.id, writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")))
        if (testName.methodName == "reviewPanelBecomingClosedLineDoesNotReplayPreview") RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario = ActivityScenario.launch(CoverageSheetTestActivity::class.java)
        if (testName.methodName != "reviewPanelBecomingClosedLineDoesNotReplayPreview") rule.onNodeWithText("View").performClick()
        rule.onNodeWithText("Find the time").performClick()
    }

    @After
    fun close() = scenario.close()

    @Test
    fun aPanelRecreatedAsAClosedLineAsksNoPreviewWhenItOpens() {
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()
        assertEquals(PlanPreviewState.Idle, CoverageSheetTest.viewModel.slotPreview.value)
        rule.onNodeWithText("View").performClick()
        rule.waitForIdle()
        assertEquals(PlanPreviewState.Idle, CoverageSheetTest.viewModel.slotPreview.value)
    }

    @Test
    fun aSearchThatAnswersAfterItsSheetClosedAsksNoPreviewWhenItOpensAgain() {
        rule.onNodeWithContentDescription("Close sheet").performClick()
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()

        rule.onNodeWithText("View").performClick()
        rule.waitForIdle()

        assertTrue(CoverageSheetTest.viewModel.timeToCover.value is TimeToCoverState.Answered)
        assertEquals(PlanPreviewState.Idle, CoverageSheetTest.viewModel.slotPreview.value)
    }

    @Test
    fun aSearchThatAnswersWhileTheOpenSheetIsRecreatedAsksItsPreviewOnce() {
        rule.waitForIdle()
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertNotNull((CoverageSheetTest.viewModel.slotPreview.value as? PlanPreviewState.Asked))
        assertNull(CoverageSheetTest.viewModel.outcomes.coverageFound.value)
    }
}

/** What outlives [CoverageSheetTestActivity]'s recreations, as a navigation entry's view models do. */
object CoverageSheetTest {
    lateinit var page: PlanPageState
    lateinit var viewModel: PlanViewModel
}

class CoverageSheetTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = CoverageSheetTest.page
        val viewModel = CoverageSheetTest.viewModel
        setContent {
            ZoonkTheme {
                val timeToCover by viewModel.timeToCover.collectAsState()
                val preview by viewModel.slotPreview.collectAsState()
                val navigator = rememberAppNavigator()
                VisitOf(viewModel.visit)
                Column {
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
                            if (androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp >
                                900
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
