package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
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
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanChangePreview
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Add to my plan on a later day's fit offer adds its lessons once though the window changes width, both ways, while
 * it checks today's numbers. Leaving the Plan while it checks adds nothing (`FitOfferCheckTest`).
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
    fun aCheckOutWhileTheWindowWidensAndNarrowsAddsTheLessonsOnce() {
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
        FitOfferTest.page = page
        FitOfferTest.viewModel =
            PlanViewModel(
                PlanStore(api, cache),
                page.goal.id,
                writingWaits(WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")),
            )
        scenario = ActivityScenario.launch(FitOfferTestActivity::class.java)

        rule.onNodeWithText("Add to my plan").performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(listOf(plan.fitOffer!!.operations.map { it.op }), api.changes)
    }
}

/** What outlives [FitOfferTestActivity]'s recreations, as a navigation entry's view models do. */
object FitOfferTest {
    lateinit var page: PlanPageState
    lateinit var viewModel: PlanViewModel
}

class FitOfferTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = FitOfferTest.page
        val viewModel = FitOfferTest.viewModel
        setContent {
            ZoonkTheme {
                val preview by viewModel.slotPreview.collectAsState()
                val pending by viewModel.pending.collectAsState()
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
