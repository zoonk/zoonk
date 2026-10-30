package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.height
import androidx.compose.ui.unit.width
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanEffect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h1600dp")
class PlanSheetsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val changes = mutableListOf<Pair<PlanPart, List<PlanOp>>>()
    private var answer: (PlanChangeResult?) -> Unit = {}
    private var edits by mutableStateOf(PlanEdits())
    private var done = 0
    private var focusTests = 0
    private val previews = mutableListOf<List<PlanOp>>()
    private val sheetAnswers = mutableStateMapOf<UUID, PlanChangeResult?>()
    private var open by mutableStateOf(true)

    private fun edits(latest: EditorChange? = null) =
        PlanEdits(
            latest = latest,
            changes = latest?.let { mapOf(it.change.id to it) }.orEmpty(),
            change = { part, operations, answered ->
                changes += part to operations
                answer = answered
            },
            sheetAnswers = sheetAnswers,
            answerSheet = { opening, result -> sheetAnswers[opening] = result },
        )

    private fun page(plan: Plan) = learnerSummary().let { PlanPageState(it.goals.first(), plan, it) }

    private fun focus(plan: Plan = coveragePlan(areas = "[${area("Algebra", focused = true)},${area("Geometry")}]")) {
        edits = edits()
        compose.setContent {
            ZoonkTheme { Column { if (open) ChooseFocusBody(page(plan), edits, onFocusTest = { focusTests++ }, onDone = { done++ }) } }
        }
    }

    private fun everything(preview: PlanPreviewState = PlanPreviewState.Idle) {
        edits = edits()
        compose.setContent {
            ZoonkTheme {
                Column {
                    StudyEverythingBody(
                        page(coveragePlan()),
                        edits,
                        preview,
                        onPreview = { previews += it },
                        onDone = { done++ },
                    )
                }
            }
        }
    }

    @Test
    fun focusingSavesTheSubjectsPicked() {
        focus()

        compose.onNodeWithText("Focus on these").assertIsNotEnabled()
        compose.onNodeWithText("Geometry").performClick()
        compose.onNodeWithText("Focus on these").assertIsEnabled().performClick()

        assertEquals(listOf(PlanPart.Focus to listOf<PlanOp>(PlanOp.FocusAreas(listOf("Algebra", "Geometry")))), changes)
    }

    @Test
    fun aFocusThatChangesNothingSaysWhy() {
        focus()
        compose.onNodeWithText("Geometry").performClick()
        compose.onNodeWithText("Focus on these").performClick()

        answer(PlanChangeResult(change = null, status = PlanChangeResult.Status.UNCHANGED, reason = PlanChangeResult.Reason.ALREADY_IN))

        compose.onNodeWithText("Nothing changed: Algebra and Geometry already have every lesson in your plan.").assertIsDisplayed()
        compose.onNodeWithText("Focus on these").assertIsNotEnabled()
    }

    @Test
    fun aFocusAppliedShowsWhatItDidWithUndo() {
        focus()
        compose.onNodeWithText("Geometry").performClick()
        compose.onNodeWithText("Focus on these").performClick()

        answer(PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED))
        edits = edits(latest = EditorChange(planChange()))

        compose.onNodeWithText("Undo").assertIsDisplayed()
        compose.onNodeWithText("Done").performClick()
        assertEquals(1, done)
    }

    @Test
    fun aFocusSavedFromAnEarlierOpeningLeavesTheNextOneOpen() {
        focus()
        compose.onNodeWithText("Geometry").performClick()
        compose.onNodeWithText("Focus on these").performClick()
        open = false
        compose.waitForIdle()
        open = true
        compose.waitForIdle()

        answer(PlanChangeResult(change = null, status = PlanChangeResult.Status.APPLIED))

        compose.onNodeWithText("Focus on these").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun theFocusTestComesFirst() {
        focus()

        compose.onNodeWithText("Take a short test").performClick()

        assertEquals(1, focusTests)
    }

    @Test
    fun studyEverythingAsksWhenItWouldEndAndSavesOnlyOnTheTap() {
        everything()

        assertEquals(listOf(listOf<PlanOp>(PlanOp.TargetDate(null))), previews)
        assertTrue(changes.isEmpty())
        compose.onNode(hasText("Study everything") and hasClickAction()).performClick()

        assertEquals(listOf(PlanPart.FullCourse to listOf<PlanOp>(PlanOp.TargetDate(null))), changes)
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun theProgressRingsLeaveTheirLabelsRoomToReadInWordsAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        val page = page(learnPlan())
        compose.setContent {
            val links = PlanLinks(rememberAppNavigator(), page)
            ZoonkTheme {
                Column(Modifier.padding(horizontal = SHEET_MARGIN)) {
                    PreparationDetails(
                        progress(),
                        forExam = false,
                        lessons = Standing.Progress(progress(), 13, 46),
                        links = links,
                    )
                }
            }
        }

        val label = compose.onNodeWithText("Long-term memory", useUnmergedTree = true).getBoundsInRoot()
        assertTrue(label.width > label.height)
    }

    @Test
    fun studyEverythingSaysWhenItWouldEnd() {
        val effect =
            PlanEffect(
                endDateAfter = kotlinx.datetime.LocalDate.parse("2028-03-10"),
                endDateBefore = null,
                lessonsAdded = 30,
                lessonsRemoved = 0,
            )
        val request = PlanPreviewState.Loading(listOf(PlanOp.TargetDate(null)), coveragePlan())
        everything(request.resolve(request, PlanChangePreview(effect = effect, feasibility = null, ready = true, unchanged = false)))

        compose.onNodeWithText("At 20 min a day, you finish in March 2028.").assertIsDisplayed()
        assertTrue(previews.isEmpty())
    }
}
