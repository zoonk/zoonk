package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isPopup
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanChangeResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanEditorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var asked by mutableStateOf(emptyMap<PlanPart, List<PlanOp>>())
    private var sheetAnswers by mutableStateOf(emptyMap<UUID, PlanChangeResult?>())
    private val toolAskers = mutableListOf<PlanAsker?>()

    private fun show(extra: String) {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan(extra), summary)
        compose.setContent {
            val edits =
                PlanEdits(
                    asked = asked,
                    chooseTools = { answer, asker ->
                        toolAskers += asker
                        asked = asked + (PlanPart.Tools to listOf(answer.operation))
                    },
                    sheetAnswers = sheetAnswers,
                )
            ZoonkTheme { Column { PlanEditorBody(page, edits) } }
        }
    }

    @Test
    fun anEarlierToolSaveLeavesTheNextToolsSheetOpen() {
        show(TOOLS)
        compose.onNodeWithContentDescription("Choose how you'll use Python").performScrollTo().performClick()
        compose.onNodeWithText("I have it").performClick()
        compose.onNodeWithText("Save").performClick()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("1 more tool later: Spreadsheet").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Choose how you'll use Spreadsheet (Google Sheets or Excel)").performScrollTo().performClick()

        compose.runOnIdle {
            val opening = (toolAskers.single() as PlanAsker.Sheet).opening
            sheetAnswers = sheetAnswers + (opening to PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED))
        }

        compose.onNodeWithText("Do you have it?").assertIsDisplayed()
    }

    @Test
    fun changingDailyTimeUsesTheWeekShapeThatArrivedWhileTheMenuWasOpen() {
        val summary = learnerSummary()
        val plan = coveragePlan()
        val shape = plan.schedule.shape.copy(canDiffer = true, weekendDays = listOf(0L, 6L))
        var schedule by mutableStateOf(plan.schedule.copy(shape = shape))
        val drafts = EditorDrafts()
        val changes = mutableListOf<PlanOp>()
        val edits = PlanEdits(change = { _, operations, _ -> changes += operations })
        compose.setContent {
            ZoonkTheme { PlanScheduleSection(PlanPageState(summary.goals.first(), plan.copy(schedule = schedule), summary), edits, drafts) }
        }

        compose.onNodeWithContentDescription("Daily study time, 20\u00A0min").performClick()
        compose.onNode(hasText("30\u00A0min") and hasAnyAncestor(isPopup())).assertExists()
        compose.runOnIdle { schedule = schedule.copy(shape = shape.copy(weekend = 30)) }
        compose.onNode(hasText("30\u00A0min") and hasAnyAncestor(isPopup())).performClick()

        assertEquals(listOf(PlanOp.WeekdayMinutes(listOf(1, 2, 3, 4, 5), 30)), changes)
    }

    @Test
    fun changingWeekendTimeAfterRemovingSaturdayLeavesSaturdayOff() {
        val summary = learnerSummary()
        val plan = coveragePlan()
        val shape = plan.schedule.shape.copy(canDiffer = true, weekend = 20, weekendDays = listOf(0L, 6L))
        var schedule by mutableStateOf(plan.schedule.copy(shape = shape))
        val drafts = EditorDrafts()
        val changes = mutableListOf<PlanOp>()
        val edits = PlanEdits(change = { _, operations, _ -> changes += operations })
        compose.setContent {
            ZoonkTheme { PlanScheduleSection(PlanPageState(summary.goals.first(), plan.copy(schedule = schedule), summary), edits, drafts) }
        }
        compose.onNodeWithText("Weekend time").performClick()
        compose.onNode(hasText("30\u00A0min") and hasAnyAncestor(isPopup())).assertExists()
        compose.runOnIdle { schedule = schedule.copy(shape = shape.copy(weekendDays = listOf(0L))) }
        compose.onNode(hasText("30\u00A0min") and hasAnyAncestor(isPopup())).performClick()

        assertEquals(listOf(PlanOp.WeekdayMinutes(listOf(0), 30)), changes)
    }

    @Test
    fun movingTheDateUsesTheDateThatFinishedLoading() {
        val summary = learnerSummary()
        val plan = coveragePlan()
        val page = PlanPageState(summary.goals.first(), plan, summary)
        val date = LocalDate.of(2027, 4, 18)
        var search by mutableStateOf<TimeToCoverState>(TimeToCoverState.Idle)
        var searches = 0
        val changes = mutableListOf<PlanOp>()
        val edits =
            PlanEdits(
                findTimeToCover = { _, _ -> searches++ },
                change = { _, operations, _ -> changes += operations },
            )
        compose.setContent {
            ZoonkTheme { MoveDateSwitch(page, edits.copy(timeToCover = search), remember { CoverageFocus() }) }
        }
        compose.onNodeWithText("Move your date to cover everything").assertIsDisplayed()

        compose.runOnIdle { search = TimeToCoverState.Answered(planAdviceRevision(plan), timeToCover(fittingDate = date.toString())) }
        compose.onNodeWithText("Move your date to ", substring = true).performClick()

        assertEquals(0, searches)
        assertEquals(listOf(PlanOp.TargetDate(date)), changes)
    }

    @Test
    fun thePastDateSuggestionSearchesFromTheRefreshedPlan() {
        val summary = learnerSummary()
        val plan = coveragePlan()
        var shown by mutableStateOf(plan)
        val searchedMinutes = mutableListOf<Long>()
        val edits = PlanEdits(findTimeToCover = { asked, _ -> searchedMinutes += asked.schedule.dailyMinutes })
        val state = SlotState()
        val focus = SlotFocus()
        val host = SlotHost()
        compose.setContent {
            ZoonkTheme {
                val page = PlanPageState(summary.goals.first(), shown, summary)
                val links = PlanLinks(rememberAppNavigator(), page)
                val slot = Slot(page, edits, links, host, state, SuggestionLayout.Panel, focus)
                PastDateSuggestion(SlotItem.PastDate(4), slot, onAdjust = {})
            }
        }
        compose.onNodeWithText("Find a date").assertIsDisplayed()
        compose.runOnIdle { shown = plan.copy(schedule = plan.schedule.copy(dailyMinutes = 30)) }
        compose.onNodeWithText("Find a date").performClick()
        assertEquals(listOf(30L), searchedMinutes)
    }

    private companion object {
        const val TOOLS =
            """"tools":[{"choice":null,"essential":true,"later":false,"name":"Python","system":null},""" +
                """{"choice":null,"essential":false,"later":true,"name":"Spreadsheet (Google Sheets or Excel)","system":null}]"""
    }
}
