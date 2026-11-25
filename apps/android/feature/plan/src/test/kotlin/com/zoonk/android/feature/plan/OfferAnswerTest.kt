package com.zoonk.android.feature.plan

import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** An offer the learner adds leaves the plan it was read from, and its card still says what it did, with Undo. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class OfferAnswerTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private val api = FakePlanApi()
    private val summary = learnerSummary()
    private val store =
        PlanStore(
            api,
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            ),
        )
    private var page by mutableStateOf(PlanPageState(summary.goals.first(), plan(), summary))
    private val viewModel =
        PlanViewModel(
            store,
            page.goal.id,
            writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")),
            PlanNavigationModel(GoalSwitch { true }),
        )

    @Test
    fun addedStrategyStillSaysWhatItDidOnceThePlanNoLongerOffersIt() {
        show(
            """"extraOffer":{"canApply":true,"fits":true,"lessons":15,""" +
                """"operations":[{"kind":"setExtras","skillIds":["strategy-time"]}],""" +
                """"effect":{"lessonsAdded":15,"lessonsRemoved":0,"topicsAdded":[]}},"hasNotice":true""",
        )

        addAndReadThePlanAgain()

        compose.onNodeWithText("Plan updated").assertExists()
        compose.onNodeWithText("Undo").assertExists()
    }

    @Test
    fun addedFitLessonsStillSayWhatTheyDidOnceThePlanNoLongerOffersThem() {
        show(
            """"fitOffer":{"canApply":true,"fits":false,"operations":[{"kind":"fitLessons"}],"effect":{"lessonsAdded":6,""" +
                """"lessonsRemoved":0,"topicsAdded":[{"area":"Web apps","topics":["Flask"]}]}}""",
        )

        addAndReadThePlanAgain()

        compose.onNodeWithText("Plan updated").assertExists()
        compose.onNodeWithText("Undo").assertExists()
    }

    private fun addAndReadThePlanAgain() {
        compose.onNodeWithText("Add to plan").performClick()
        compose.waitForIdle()
        page = page.copy(plan = plan())
        compose.waitForIdle()
    }

    private fun show(offer: String) {
        page = page.copy(plan = plan(offer))
        api.shownPlan = page.plan
        runBlocking(Dispatchers.Main.immediate) { store.plan[page.goal.id].refresh() }
        compose.setContent {
            ZoonkTheme {
                val preview by viewModel.slotPreview.collectAsState()
                val pending by viewModel.pending.collectAsState()
                val navigator = rememberAppNavigator()
                PlanSuggestionSlot(
                    page = page,
                    edits = PlanEdits(pending = pending, change = viewModel::change, outcomes = viewModel.outcomes),
                    links = PlanLinks(navigator, page),
                    onAdjust = {},
                    layout = SuggestionLayout.Panel,
                    host =
                        SlotHost(
                            preview = preview,
                            clearPreview = viewModel::clearSlotPreview,
                            addFitOffer = { viewModel.addFitOffer(page.plan, it) },
                            addExtraOffer = { viewModel.addExtraOffer(page.plan, it) },
                        ),
                    state = viewModel.slotState,
                )
            }
        }
    }
}
