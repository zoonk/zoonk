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
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanEditorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val changes = mutableListOf<Pair<PlanPart, List<PlanOp>>>()
    private val undone = mutableListOf<PlanChange>()
    private val examChoices = mutableListOf<Pair<String, String>>()
    private var asked by mutableStateOf(emptyMap<PlanPart, List<PlanOp>>())
    private var shownLatest by mutableStateOf<EditorChange?>(null)

    /** [saved] is what a change answers, and becomes the latest change as the view model's does. */
    private fun show(
        extra: String = "",
        kind: String = "learn",
        latest: EditorChange? = null,
        pending: Set<PlanPart> = emptySet(),
        saved: PlanChangeResult? = null,
        preview: PlanChangePreview? = null,
        advise: suspend () -> PlanBasesAdvice? = { null },
    ) {
        val summary = learnerSummary(kind = kind)
        val page = PlanPageState(summary.goals.first(), plan(extra), summary)
        shownLatest = latest
        compose.setContent {
            val edits =
                PlanEdits(
                    pending = pending,
                    asked = asked,
                    latest = shownLatest,
                    change = { part, operations, answered ->
                        changes += part to operations
                        asked = asked + (part to operations)
                        saved?.let {
                            shownLatest = it.change?.let(::EditorChange)
                            answered(it)
                        }
                    },
                    undo = { undone += it },
                    chooseExamOption = { group, subject, _ ->
                        examChoices += group to subject
                        asked = asked + (PlanPart.ExamChoices to listOf(PlanOp.ExamChoice(group, subject)))
                    },
                    preview = { preview },
                    adviseOnBases = advise,
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

    @Test
    fun anExamOptionSavesAtOnceAndShowsAsPicked() {
        show(EXAM_CHOICES)

        compose.onNodeWithText("Pick the one you'll take. Until you do, your plan leaves Foreign language out.").assertIsDisplayed()
        compose.onNodeWithText("Spanish").performScrollTo().performClick()

        assertEquals(listOf("Foreign language" to "Spanish"), examChoices)
        compose.onNodeWithText("Spanish").assertIsSelected()
    }

    @Test
    fun prerequisitesSaveOnlyOnceTheirChangeIsCheckedAndThenSayWhatItDid() {
        val change = planChange(operations = """[{"kind":"setBaseChoices","choices":[{"skillId":"$FRACTIONS","choice":"deep"}]}]""")
        show(
            BASES,
            saved = PlanChangeResult(change = change, status = PlanChangeResult.Status.APPLIED),
            preview = PlanChangePreview(effect = null, feasibility = null, ready = true, unchanged = true),
        )

        compose.onNodeWithText("2 prerequisites, 1\u00A0hr 10\u00A0min for their essentials.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Choose prerequisites").performClick()
        compose.onNodeWithText("Save choices").assertIsNotEnabled()
        compose.onNodeWithText("In depth").performClick()
        compose.onNodeWithText("Checking what changes…").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(PREVIEW_WAIT)
        compose.onNodeWithText("Your plan stays as it is.").assertIsDisplayed()
        compose.onNodeWithText("Save choices").assertIsEnabled().performClick()

        val choices = listOf(BaseChoice(FRACTIONS, "deep"), BaseChoice(RATIOS, "deep"))
        assertEquals(listOf(PlanPart.Bases to listOf<PlanOp>(PlanOp.BaseChoices(choices))), changes)
        compose.onAllNodesWithText("1 prerequisite is studied in depth.").assertCountEquals(2)
        compose.onNodeWithText("Done").performClick()
        compose.onNodeWithText("Save choices").assertDoesNotExist()
    }

    @Test
    fun aRecommendationComesOnlyFromTheLearnersTap() {
        var asked = 0
        show(BASES) {
            asked++
            PlanBasesAdvice(daysLeft = 40, ready = true, recommended = PlanBasesAdvice.Recommended.ESSENTIAL)
        }

        compose.onNodeWithText("Choose prerequisites").performScrollTo().performClick()
        assertEquals(0, asked)
        compose.onNodeWithText("Get a recommendation").performClick()

        assertEquals(1, asked)
        compose
            .onNodeWithText(
                "We recommend the essentials, so what builds on them makes sense. Your plan already follows it.",
            ).assertIsDisplayed()
        compose.onNodeWithText("Recommended").assertIsDisplayed()
    }

    private companion object {
        const val PREVIEW_WAIT = 1_000L
        val FRACTIONS = UUID.fromString("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b01").toString()
        val RATIOS = UUID.fromString("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b02").toString()

        const val EXAM_CHOICES =
            """"examChoices":[{"group":"Foreign language","options":[{"name":"English","shortName":null},""" +
                """{"name":"Spanish","shortName":null}],"subject":null}]"""

        val BASES =
            """"bases":{"daysLeft":40,"knownCount":0,"items":[""" +
                """{"area":"Math","choice":"essential","choices":["deep","essential","quick","skip"],""" +
                """"minutes":{"deep":120,"essential":40,"quick":10},"name":"Fractions","neededFor":["Probability"],""" +
                """"skillId":"$FRACTIONS","studied":false},""" +
                """{"area":"Math","choice":"essential","choices":["deep","essential","quick","skip"],""" +
                """"minutes":{"deep":90,"essential":30,"quick":10},"name":"Ratios","neededFor":[],""" +
                """"skillId":"$RATIOS","studied":false}]}"""
    }
}
