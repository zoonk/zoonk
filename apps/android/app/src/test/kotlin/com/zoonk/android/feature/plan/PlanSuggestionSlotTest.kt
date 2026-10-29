package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h900dp")
class PlanSuggestionSlotTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var navigator: AppNavigator
    private val statuses = mutableListOf<GoalUpdateInput.Status>()
    private val chosen = mutableListOf<Pair<String, String>>()
    private val undone = mutableListOf<PlanChange>()
    private var changes by mutableStateOf(emptyMap<java.util.UUID, EditorChange>())

    private fun show(
        extra: String = "",
        status: String = "active",
        layout: SuggestionLayout = SuggestionLayout.Panel,
    ) {
        val summary = learnerSummary(status = status)
        val page = PlanPageState(summary.goals.first(), plan(extra), summary)
        compose.setContent {
            navigator = rememberAppNavigator()
            val edits =
                PlanEdits(
                    changes = changes,
                    undo = { undone += it },
                    chooseExamOption = { group, subject, answered ->
                        chosen += group to subject
                        val change = planChange(operations = """[{"kind":"setExamChoice","group":"$group","subject":"$subject"}]""")
                        changes = changes + (change.id to EditorChange(change))
                        answered(PlanChangeResult(change = change, status = PlanChangeResult.Status.APPLIED))
                    },
                )
            ZoonkTheme {
                PlanSuggestionSlot(
                    page,
                    edits,
                    PlanLinks(navigator, page),
                    Resume.Plain,
                    { statuses += it },
                    onAdjust = {},
                    layout = layout,
                )
            }
        }
    }

    @Test
    fun aPausedGoalResumesFromTheSlot() {
        show(status = "paused")

        compose.onNodeWithText("Learn Python is paused").assertIsDisplayed()
        compose.onNodeWithText("Resume").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.ACTIVE), statuses)
    }

    @Test
    fun theSlotPagesThroughItsSuggestions() {
        show(
            """"access":{"freeWeekOver":true,"mocksRequirePlus":false},"status":{"kind":"behind","days":2,"extraMinutesPerDay":10,"lessons":null}""",
        )

        compose.onNodeWithText("1 of 2").assertIsDisplayed()
        compose.onNodeWithText("A little to catch up").assertIsDisplayed()
        compose.onNodeWithContentDescription("Next").performClick()

        compose.onNodeWithText("Your free week of exam prep is over").assertIsDisplayed()
        compose.onNodeWithText("See Plus").performClick()
        compose.runOnIdle { assertEquals(AppRoute.Subscription, navigator.currentRoute) }
    }

    @Test
    fun anExamOptionChosenFromTheSlotShowsWhatItDidWithUndo() {
        show(
            """"examChoices":[{"group":"Foreign language","options":[{"name":"English","shortName":null},""" +
                """{"name":"Spanish","shortName":null}],"subject":null}]""",
        )

        compose.onNodeWithText("Spanish").performClick()
        compose.onNodeWithText("Undo").performClick()

        assertEquals(listOf("Foreign language" to "Spanish"), chosen)
        assertEquals(CHANGE_ID, undone.single().id.toString())
    }
}
