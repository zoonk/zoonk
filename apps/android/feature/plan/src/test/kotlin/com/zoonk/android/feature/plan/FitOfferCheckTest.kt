package com.zoonk.android.feature.plan

import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanEffect
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** The fit offer's card on a later day, where Add to my plan checks today's numbers first. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FitOfferCheckTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private val api = FakePlanApi()
    private val summary = learnerSummary()
    private val plan =
        plan(
            """"fitOffer":{"canApply":false,"fits":false,"operations":[{"kind":"fitLessons"}],"effect":{"lessonsAdded":6,""" +
                """"lessonsRemoved":0,"topicsAdded":[{"area":"Web apps","topics":["Flask","Django","FastAPI"]}]}}""",
        )
    private val page = PlanPageState(summary.goals.first(), plan, summary)
    private val viewModel =
        PlanViewModel(
            PlanStore(
                api,
                AppCache(
                    FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                    CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                ),
            ),
            page.goal.id,
            writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")),
        )
    private var shown by mutableStateOf(true)

    @Test
    fun closingTheSuggestionWhileItChecksAddsNothing() {
        val held = CompletableDeferred<Unit>()
        api.previewGate = held
        api.preview = checked(plan.fitOffer!!.effect)
        show()

        compose.onNodeWithText("Add to my plan").performClick()
        compose.onNodeWithText("Checking what changes…").assertExists()
        shown = false
        compose.waitForIdle()
        held.complete(Unit)
        compose.waitForIdle()

        assertEquals(emptyList<List<PlanOp>>(), api.changes)
        assertEquals(PlanPreviewState.Idle, viewModel.slotPreview.value)
    }

    @Test
    fun notNowWhileItChecksGoesBackToTheOfferAndAddsNothing() {
        val held = CompletableDeferred<Unit>()
        api.previewGate = held
        api.preview = checked(plan.fitOffer!!.effect)
        show()

        compose.onNodeWithText("Add to my plan").performClick()
        compose.onNodeWithText("Not now").performClick()
        held.complete(Unit)
        compose.waitForIdle()

        compose.onNodeWithText("Add to my plan").assertIsEnabled()
        assertEquals(emptyList<List<PlanOp>>(), api.changes)
    }

    @Test
    fun otherNumbersTodaySaySoAndTheirCountTitlesTheCard() {
        api.preview = checked(ApiJson.decodeFromString<PlanEffect>(effect(""""lessonsAdded":4""")))
        show()

        compose.onNodeWithText("Add to my plan").performClick()

        compose.onNodeWithText("The numbers are different today.").assertExists()
        compose.onNodeWithText("You have time for 4 more lessons").assertExists()
        compose.onNodeWithText("Change my plan").assertIsEnabled()
        assertEquals(emptyList<List<PlanOp>>(), api.changes)
    }

    private fun checked(effect: PlanEffect) =
        PlanChangePreview(finishDate = null, effect = effect, feasibility = null, ready = true, unchanged = false)

    private fun show() {
        compose.setContent {
            ZoonkTheme {
                val preview by viewModel.slotPreview.collectAsState()
                val pending by viewModel.pending.collectAsState()
                if (shown) {
                    val navigator = rememberAppNavigator()
                    FitLessonsSuggestion(
                        Slot(
                            page,
                            PlanEdits(pending = pending, change = viewModel::change),
                            PlanLinks(navigator, page),
                            SlotHost(
                                preview = preview,
                                clearPreview = viewModel::clearSlotPreview,
                                addFitOffer = { viewModel.addFitOffer(page.plan, it) },
                            ),
                            viewModel.slotState,
                            SuggestionLayout.Panel,
                            SlotFocus(),
                        ),
                    )
                }
            }
        }
    }
}
