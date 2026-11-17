package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasStateDescription
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
import com.zoonk.api.models.PlanChangePreview
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.IOException

/**
 * Add to my plan on a later day's fit offer checks today's numbers first, from the panel or sheet that asked: recreated
 * with that opening still shown, it adds the lessons once or says the check failed; recreated as a closed line, or left,
 * it adds and says nothing.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FitOfferWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<FitOfferTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aCheckOutWhileThePanelIsRecreatedAddsTheLessonsOnce() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(listOf(fitOperations()), api.changes)
    }

    @Test
    fun aCheckOutWhileTheOpenSheetIsRecreatedAddsTheLessonsOnce() {
        val (held, api) = launchAFitOffer(wide = false)

        rule.onNodeWithText("View").performClick()
        rule.onNodeWithText("Add to my plan").performClick()
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(listOf(fitOperations()), api.changes)
    }

    @Test
    fun aCheckAskedFromThePanelThatAnswersAfterItBecameAClosedLineAddsNothing() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(emptyList<List<PlanOp>>(), api.changes)
        assertEquals(PlanPreviewState.Idle, FitOfferTest.viewModel.slotPreview.value)
    }

    @Test
    fun aCheckFromThePanelAddsNothingWhenARefreshReplacesItsSuggestion() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        rule.runOnIdle {
            FitOfferTest.page =
                FitOfferTest.page!!.copy(
                    plan = plan("\"status\":{\"kind\":\"needsAdjusting\",\"options\":[\"addTime\"]},\"fitOffer\":null"),
                )
        }
        rule.onNodeWithText("More lessons than days left").assertExists()
        rule.onNodeWithText("Add to my plan").assertDoesNotExist()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(emptyList<List<PlanOp>>(), api.changes)
        assertEquals(PlanPreviewState.Idle, FitOfferTest.viewModel.slotPreview.value)
    }

    @Test
    fun aCheckFromThePanelAddsNothingWhenThePlanChangesButItsSuggestionStays() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        rule.runOnIdle {
            val current = FitOfferTest.page!!
            FitOfferTest.page = current.copy(plan = current.plan.copy(schedule = current.plan.schedule.copy(dailyMinutes = 30)))
        }
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(emptyList<List<PlanOp>>(), api.changes)
        assertEquals(PlanPreviewState.Idle, FitOfferTest.viewModel.slotPreview.value)
        rule.onNodeWithText("Add to my plan").assertIsEnabled()

        val next = CompletableDeferred<Unit>()
        api.previewGate = next
        rule.onNodeWithText("Add to my plan").performClick()
        rule.onNode(hasStateDescription("Checking what changes…")).assertExists()
        next.complete(Unit)
        rule.waitForIdle()

        assertEquals(listOf(fitOperations()), api.changes)
    }

    @Test
    fun anUnchangedPlanRefreshKeepsTheFitCheck() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        rule.runOnIdle {
            val current = FitOfferTest.page!!
            FitOfferTest.page = current.copy(plan = current.plan.copy())
        }
        rule.onNode(hasStateDescription("Checking what changes…")).assertExists()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(listOf(fitOperations()), api.changes)
    }

    @Test
    fun aCheckThatFailsWhileThePanelIsRecreatedSaysSo() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        scenario.recreate()
        held.completeExceptionally(IOException("offline"))
        rule.waitForIdle()

        assertTrue(FitOfferTest.viewModel.slotPreview.value is PlanPreviewState.Failed)
        assertEquals(emptyList<List<PlanOp>>(), api.changes)
    }

    @Test
    fun aCheckThatFailsAfterTheLearnerLeftThePlanSaysNothingOnTheirReturn() {
        val (held, api) = launchAFitOffer(wide = true)

        rule.onNodeWithText("Add to my plan").performClick()
        FitOfferTest.visible = false
        rule.waitForIdle()
        held.completeExceptionally(IOException("offline"))
        rule.waitForIdle()
        FitOfferTest.visible = true
        rule.waitForIdle()

        assertEquals(PlanPreviewState.Idle, FitOfferTest.viewModel.slotPreview.value)
        assertEquals(emptyList<List<PlanOp>>(), api.changes)
    }

    private fun fitOperations() =
        FitOfferTest.page!!
            .plan.fitOffer!!
            .operations
            .map { it.op }

    /** A later day's fit offer, as a panel on a [wide] window or a closed line, its check held until the returned call completes. */
    private fun launchAFitOffer(wide: Boolean): Pair<CompletableDeferred<Unit>, FakePlanApi> {
        if (wide) RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = FitOfferTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val offer =
            """"fitOffer":{"canApply":false,"fits":false,"operations":[{"kind":"fitLessons"}],"effect":{"lessonsAdded":6,""" +
                """"lessonsRemoved":0,"topicsAdded":[{"area":"Web apps","topics":["Flask","Django","FastAPI"]}]}}"""
        val plan = plan(offer)
        val summary = learnerSummary()
        val held = CompletableDeferred<Unit>()
        val api =
            FakePlanApi().apply {
                previewGate = held
                preview =
                    PlanChangePreview(
                        finishDate = null,
                        effect = plan.fitOffer!!.effect,
                        feasibility = null,
                        ready = true,
                        unchanged = false,
                    )
            }
        val page = PlanPageState(summary.goals.first(), plan, summary)
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        FitOfferTest.visible = true
        api.shownPlan = plan
        val store = PlanStore(api, cache)
        runBlocking(Dispatchers.Main.immediate) { store.plan[page.goal.id].refresh() }
        FitOfferTest.store = store
        FitOfferTest.page = page
        FitOfferTest.viewModel =
            PlanViewModel(
                store,
                page.goal.id,
                writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")),
                PlanNavigationModel(GoalSwitch { true }),
            )
        scenario = ActivityScenario.launch(FitOfferTestActivity::class.java)
        return held to api
    }
}

/** What outlives [FitOfferTestActivity]'s recreations, as a navigation entry's view models do. */
object FitOfferTest {
    /** False while the learner is away from the Plan, its view models kept, as another tab keeps them. */
    var visible by mutableStateOf(true)
    private var shownPage by mutableStateOf<PlanPageState?>(null)
    lateinit var store: PlanStore
    var page: PlanPageState?
        get() = shownPage
        set(value) {
            value?.let { page -> store.plan[page.goal.id].update { it.copy(plan = page.plan) } }
            shownPage = value
        }
    lateinit var viewModel: PlanViewModel
}

class FitOfferTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val viewModel = FitOfferTest.viewModel
        setContent {
            ZoonkTheme {
                val page = checkNotNull(FitOfferTest.page)
                val preview by viewModel.slotPreview.collectAsState()
                val pending by viewModel.pending.collectAsState()
                val navigator = rememberAppNavigator()
                if (FitOfferTest.visible) {
                    VisitOf(viewModel.visit)
                    PlanSuggestionSlot(
                        page = page,
                        edits = PlanEdits(pending = pending, change = viewModel::change, outcomes = viewModel.outcomes),
                        links = PlanLinks(navigator, page),
                        resume = Resume.Plain,
                        onAdjust = {},
                        host =
                            SlotHost(
                                preview = preview,
                                clearPreview = viewModel::clearSlotPreview,
                                addFitOffer = { viewModel.addFitOffer(page.plan, it) },
                            ),
                        state = viewModel.slotState,
                        layout =
                            if (with(LocalDensity.current) {
                                    LocalWindowInfo.current.containerSize.width
                                        .toDp()
                                } >
                                900.dp
                            ) {
                                SuggestionLayout.Panel
                            } else {
                                SuggestionLayout.Line
                            },
                    )
                }
            }
        }
    }
}
