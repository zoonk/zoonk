package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanEditorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val changes = mutableListOf<Pair<PlanPart, List<PlanOp>>>()
    private val undone = mutableListOf<PlanChange>()
    private var asked by mutableStateOf(emptyMap<PlanPart, List<PlanOp>>())

    private fun show(
        extra: String = "",
        kind: String = "learn",
        latest: EditorChange? = null,
        pending: Set<PlanPart> = emptySet(),
    ) {
        val summary = learnerSummary(kind = kind)
        val page = PlanPageState(summary.goals.first(), plan(extra), summary)
        compose.setContent {
            val edits =
                PlanEdits(
                    pending = pending,
                    asked = asked,
                    latest = latest,
                    change = { part, operations, _: (PlanChangeResult?) -> Unit ->
                        changes += part to operations
                        asked = asked + (part to operations)
                    },
                    undo = { undone += it },
                )
            ZoonkTheme { Column { PlanEditorBody(page, edits) } }
        }
    }

    @Test
    fun aTimeChipSavesTheDailyTimeAndShowsTheTapAtOnce() {
        show()

        compose
            .onNodeWithText(
                "45\u00A0min",
            ).assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
            .performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(45))), changes)
        compose.onNodeWithText("45\u00A0min").assertIsSelected()
    }

    @Test
    fun anotherTimeFromTheMenuJoinsThePresets() {
        show()

        compose.onNodeWithText("Other time…").performClick()
        compose.onNodeWithText("5\u00A0hr").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(300))), changes)
        compose.onNodeWithText("5\u00A0hr").assertIsSelected()
    }

    @Test
    fun theLastStudyDayCantBeTurnedOff() {
        show(
            """"schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":1,"targetDateEstimated":false,""" +
                """"targetDateNamedMonth":false,"weekdayMinutes":[0,0,0,20,0,0,0]}""",
        )

        compose.onNodeWithContentDescription("Wednesday").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Thursday").assertIsOff().performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.WeekdayMinutes(listOf(4), 20))), changes)
    }

    @Test
    fun steeringWaitsUntilTheLearnerHasStudied() {
        show()
        compose.onNodeWithText("How is it going?").assertDoesNotExist()
    }

    @Test
    fun tappingAnActiveSteerGoesBackToTheDefault() {
        show(""""steering":{"difficultyBias":"harder","lessonsStudied":3,"practiceBias":"balanced","skippedActivities":[]}""")

        compose
            .onNodeWithText("Too easy")
            .performScrollTo()
            .assertIsSelected()
            .performClick()

        assertEquals(listOf(PlanPart.Steering to listOf<PlanOp>(PlanOp.DifficultyBias("standard"))), changes)
    }

    @Test
    fun aLanguagePlanChoosesWhatItPractices() {
        show(kind = "language")

        compose.onNodeWithText("Listening").performScrollTo().performClick()

        assertEquals(listOf(PlanPart.Activities to listOf<PlanOp>(PlanOp.SkipActivities(listOf("listening")))), changes)
    }

    @Test
    fun theLatestChangeCanBeUndone() {
        show(latest = EditorChange(planChange(operations = """[{"kind":"setDailyMinutes","minutes":45}]""")))

        compose.onNodeWithText("Undo").performClick()

        assertEquals(CHANGE_ID, undone.single().id.toString())
    }

    @Test
    fun anUndoneChangeSaysThePlanIsBack() {
        show(latest = EditorChange(planChange(), undone = true))

        compose.onNodeWithText("Undone. Your plan is back as it was.").assertIsDisplayed()
        compose.onNodeWithText("Undo").assertDoesNotExist()
    }
}
