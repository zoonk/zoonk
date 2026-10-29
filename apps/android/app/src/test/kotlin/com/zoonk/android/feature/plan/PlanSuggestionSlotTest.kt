package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.StudyNext
import com.zoonk.api.models.StudyNextNextLevel
import com.zoonk.api.models.StudyNextRelatedInner
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
    private var search by mutableStateOf<TimeToCoverState>(TimeToCoverState.Idle)
    private var preview by mutableStateOf<PlanPreviewState>(PlanPreviewState.Idle)
    private val applied = mutableListOf<List<PlanOp>>()
    private val adjusted = mutableListOf<PlanSection?>()

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

    @Test
    fun anUndoThatDidntSaveSaysSoOnTheLine() {
        show(
            """"examChoices":[{"group":"Foreign language","options":[{"name":"English","shortName":null},""" +
                """{"name":"Spanish","shortName":null}],"subject":null}]""",
            layout = SuggestionLayout.Line,
        )
        compose.onNodeWithText("Choose").performClick()
        compose.onNodeWithText("Spanish").performClick()

        changes = changes.mapValues { it.value.copy(undoFailed = true) }

        compose.onAllNodesWithText("That didn't save. Try again.").onFirst().assertIsDisplayed()
    }

    /** A slot whose finds, previews and changes answer at once, as the plan's would. */
    private fun showSlot(
        plan: Plan,
        found: com.zoonk.api.models.PlanTimeToCover = timeToCover(),
        next: StudyNext? = null,
        onContinue: () -> Unit = {},
    ) {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan, summary)
        compose.setContent {
            navigator = rememberAppNavigator()
            val edits =
                PlanEdits(
                    changes = changes,
                    undo = { undone += it },
                    timeToCover = search,
                    findTimeToCover = { asked, answer ->
                        search = TimeToCoverState.Answered(timeToCoverRevision(asked), found)
                        answer(TimeToCoverOutcome.Answered(found))
                    },
                    change = { _, operations, answered ->
                        applied += operations
                        val change = planChange(operations = """[{"kind":"fitLessons"}]""")
                        changes = changes + (change.id to EditorChange(change))
                        answered(PlanChangeResult(change = change, status = PlanChangeResult.Status.APPLIED))
                    },
                )
            val host =
                SlotHost(
                    preview = preview,
                    requestPreview = { preview = ready(it, plan) },
                    clearPreview = { preview = PlanPreviewState.Idle },
                    next = next,
                    onContinue = onContinue,
                )
            ZoonkTheme {
                PlanSuggestionSlot(
                    page,
                    edits,
                    PlanLinks(navigator, page),
                    Resume.Plain,
                    {},
                    onAdjust = { adjusted += it },
                    layout = SuggestionLayout.Panel,
                    host = host,
                )
            }
        }
    }

    private fun ready(
        operations: List<PlanOp>,
        plan: Plan,
    ) = PlanPreviewState.Loading(operations, plan).let {
        it.resolve(
            it,
            PlanChangePreview(
                effect = ApiJson.decodeFromString<PlanEffect>(effect()).copy(lessonsAdded = 14),
                feasibility = null,
                ready = true,
                unchanged = false,
            ),
        )
    }

    @Test
    fun theCoverageItemFindsTheTimeThenPreviewsAndAppliesIt() {
        showSlot(coveragePlan(), found = timeToCover(recommended = 45))

        compose.onNodeWithText("Find the time that covers everything").performClick()
        compose.onNodeWithText("covers everything in depth", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Apply").performClick()

        assertEquals(listOf(listOf<PlanOp>(PlanOp.DailyMinutes(45))), applied)
        compose.onNodeWithText("Plan updated").assertIsDisplayed()
        compose.onNodeWithText("Undo").performClick()
        assertEquals(CHANGE_ID, undone.single().id.toString())
    }

    @Test
    fun aGoalsCoverageMovesItsDateFromOtherOptions() {
        showSlot(coveragePlan(), found = timeToCover(recommended = 45, fittingDate = "2027-04-18"))

        compose.onNodeWithText("Other options").performClick()
        compose.onNodeWithText("Move your date to cover everything").performClick()
        compose.onNodeWithText("Apply").performClick()

        assertEquals(listOf(listOf<PlanOp>(PlanOp.TargetDate(java.time.LocalDate.parse("2027-04-18")))), applied)
    }

    @Test
    fun notNowPutsAnItemOffForThisOpening() {
        showSlot(coveragePlan(extra = BEHIND))

        compose.onNodeWithContentDescription("Next").performClick()
        compose.onNodeWithText("Other options").performClick()
        compose.onNodeWithText("Not now").performClick()

        compose.onNodeWithText("A little to catch up").assertIsDisplayed()
        compose.onNodeWithText("1 of 2").assertDoesNotExist()
    }

    @Test
    fun theLessonsTheTimeFitsAreAppliedAfterTheirDiff() {
        showSlot(plan(FIT_OFFER))

        compose.onNodeWithText("6 more lessons fit in your time").assertIsDisplayed()
        compose.onNodeWithText("Apply").performClick()

        assertEquals(listOf(listOf<PlanOp>(PlanOp.FitLessons)), applied)
        compose.onNodeWithText("Plan updated").assertIsDisplayed()
    }

    @Test
    fun aResultKeepsThePagersPlace() {
        showSlot(plan("$BEHIND,$FIT_OFFER"))
        compose.onNodeWithContentDescription("Next").performClick()
        val top = compose.onNodeWithText("6 more lessons fit in your time").getUnclippedBoundsInRoot().top

        compose.onNodeWithText("Apply").performClick()

        assertEquals(top, compose.onNodeWithText("Plan updated").getUnclippedBoundsInRoot().top)
        compose.onNodeWithContentDescription("Next").assertDoesNotExist()
    }

    @Test
    fun aPassedDateFindsTheDateThatCoversWhatsLeftOnlyFromPreview() {
        showSlot(
            plan(""""status":{"kind":"pastDate","lessons":4}"""),
            found = timeToCover(recommended = null, fittingDate = "2027-04-18"),
        )

        compose.onNodeWithText("Your date came with 4 lessons left").assertIsDisplayed()
        assertEquals(TimeToCoverState.Idle, search)
        compose.onNodeWithText("Preview").performClick()
        compose.onNodeWithText("Apply").performClick()

        assertEquals(listOf(listOf<PlanOp>(PlanOp.TargetDate(java.time.LocalDate.parse("2027-04-18")))), applied)
    }

    @Test
    fun aPassedDateOpensTheDateToAdjust() {
        showSlot(plan(""""status":{"kind":"pastDate","lessons":4}"""))

        compose.onNodeWithText("Other options").performClick()
        compose.onNodeWithText("Adjust plan").performClick()

        assertEquals(listOf<PlanSection?>(PlanSection.Date), adjusted)
    }

    @Test
    fun aFinishedPlanContinuesAtTheNextLevelOrOpensARelatedCourse() {
        var continued = 0
        val course = java.util.UUID.fromString(CHANGE_ID)
        showSlot(
            plan(),
            next =
                StudyNext(
                    nextLevel = StudyNextNextLevel(0, course, StudyNextNextLevel.Level.INTERMEDIATE, "Python"),
                    related = listOf(StudyNextRelatedInner("zoonk", course, "data-science", "Data science")),
                ),
            onContinue = { continued++ },
        )

        compose.onNodeWithText("You finished your plan").assertIsDisplayed()
        compose.onNodeWithText("Continue at Intermediate").performClick()
        assertEquals(1, continued)

        compose.onNodeWithText("Data science").performClick()
        compose.runOnIdle { assertEquals(AppRoute.CatalogCourse(CHANGE_ID), navigator.currentRoute) }
    }

    private companion object {
        const val BEHIND = """"status":{"kind":"behind","days":2,"extraMinutesPerDay":10,"lessons":null}"""
        const val FIT_OFFER =
            """"fitOffer":{"canApply":true,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":false,""" +
                """"operations":[{"kind":"fitLessons"}]}"""
    }
}
