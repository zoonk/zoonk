package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollToKeyAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.goalcontent.modulesSyllabus
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanStatus
import com.zoonk.api.models.Syllabus
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanContentTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var navigator: AppNavigator
    private val statuses = mutableListOf<GoalUpdateInput.Status>()
    private val farTopics = mutableListOf<FarTopic>()
    private val adjusted = mutableListOf<PlanSection?>()

    private fun show(
        status: String = "active",
        resumeChangesPlan: Boolean = false,
        kind: String = "learn",
        resume: Resume = if (resumeChangesPlan) Resume.Confirm else Resume.Plain,
        structure: Syllabus? = null,
        plan: Plan = learnPlan(),
        standing: Standing? = if (kind == "language") null else Standing.Progress(progress(), done = 13, known = 0, total = 46),
    ) {
        val summary = learnerSummary(status = status, kind = kind)
        val page = PlanPageState(summary.goals.first(), plan, summary)
        compose.setContent {
            navigator = rememberAppNavigator()
            ZoonkTheme {
                PlanContent(
                    page = page,
                    standing = standing,
                    structure = structure,
                    links = PlanLinks(navigator, page, openFarTopic = { farTopics += it }),
                    resume = resume,
                    isSaving = false,
                    onSetStatus = { statuses += it },
                    onAdjust = { adjusted += it },
                )
            }
        }
    }

    @Test
    fun archivingAsksFirst() {
        show()

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Archive this goal").performClick()
        assertEquals(emptyList<GoalUpdateInput.Status>(), statuses)
        compose.onNodeWithText("Archive Learn Python?").assertIsDisplayed()
        compose.onNodeWithText("Archive").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.ARCHIVED), statuses)
    }

    @Test
    fun pausingSavesAtOnce() {
        show()

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Pause this goal").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.PAUSED), statuses)
    }

    @Test
    fun resumingSaysWhatItChangesWhenItChangesThePlan() {
        show(status = "paused", resumeChangesPlan = true)

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Resume this goal").performClick()
        compose
            .onNodeWithText(
                "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            ).assertIsDisplayed()
        compose.onNodeWithText("Resume").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.ACTIVE), statuses)
    }

    @Test
    fun theOpenPhasesChaptersLeadToTheirPages() {
        show()

        compose.onNodeWithText("Sets and tuples").performClick()

        compose.runOnIdle { assertEquals(AppRoute.Chapter(CHAPTER_LATER), navigator.currentRoute) }
    }

    @Test
    fun aFarTopicOpensItsSheetWithWhatItsRowSays() {
        show()

        compose.onNodeWithText("Web apps").performClick()
        compose.onNodeWithText("Flask").performClick()

        assertEquals(listOf(FarTopic(UUID.fromString(FAR_SKILL), "Flask", null, LocalDate(2026, 11, 11))), farTopics)
    }

    @Test
    fun theUpNextChapterUnderItsPhaseIsHighlightedAcrossThePath() {
        show()

        val page = compose.onRoot().getBoundsInRoot()
        val row = compose.onAllNodes(hasText("Dictionaries") and hasClickAction()).onFirst().getBoundsInRoot()
        assertEquals(page.left, row.left)
        assertEquals(page.right, row.right)
    }

    @Test
    fun aPhaseChallengeSaysWhenItOpensUntilItCanBeOpened() {
        show()

        compose.onAllNodesWithText("Opens after this phase's lessons").onFirst().assertIsDisplayed()
    }

    @Test
    fun aPhaseChallengeThatCanBeOpenedSaysNothingMore() {
        val plan = learnPlan()
        show(
            plan =
                plan.copy(
                    phases =
                        plan.phases.map { phase ->
                            phase.copy(checkpoint = phase.checkpoint?.copy(planItemId = UUID.fromString(CHECKPOINT_ITEM)))
                        },
                ),
        )

        compose.onAllNodesWithText("Opens after this phase's lessons").assertCountEquals(0)
    }

    @Test
    fun aPhaseChallengeSaysWhatItIs() {
        show()

        compose.onAllNodesWithText("Questions on this phase, with no hints").onFirst().assertIsDisplayed()
    }

    @Test
    fun aLanguageUnitsChallengeIsALiveCall() {
        show(kind = "language")

        compose.onAllNodesWithText("A live call where you get your point across").onFirst().assertIsDisplayed()
        compose.onAllNodesWithText("Questions on this phase, with no hints").assertCountEquals(0)
    }

    @Test
    fun theListOfEveryPhaseLeavesOutWhatAChallengeIs() {
        show(structure = modulesSyllabus())

        compose.onNode(hasClickLabel("Your path")).performClick()

        compose.onNode(hasText("Phase challenge") and hasAnyAncestor(isDialog())).assertExists()
        compose.onAllNodes(hasText("Questions on this phase, with no hints") and hasAnyAncestor(isDialog())).assertCountEquals(0)
    }

    @Test
    fun aPhaseWhoseChallengeHasNoTimeBeforeTheDateSaysSoUntilItIsPast() {
        val plan = learnPlan()
        show(
            plan =
                plan.copy(
                    phases =
                        plan.phases.map { phase ->
                            when (phase.index) {
                                0L -> phase.copy(state = PlanPhase.State.UNFINISHED, challengeLeftOut = true)
                                1L, 3L -> phase.copy(challengeLeftOut = true)
                                else -> phase
                            }
                        },
                ),
        )

        compose.onAllNodesWithText("No time for this phase's challenge before your date").assertCountEquals(2)
        compose.onNodeWithText("Challenge left out").assertIsDisplayed()
    }

    @Test
    fun aPlanWithEveryLessonDoneAndAChallengeWithNoTimeAsksToAdjustIt() {
        val plan = learnPlan()
        show(
            plan =
                plan.copy(
                    phases =
                        plan.phases.map { phase ->
                            phase.copy(lessonsDone = phase.lessonsTotal, challengeLeftOut = phase.index == 3L)
                        },
                    status = ApiJson.decodeFromString<PlanStatus>("""{"kind":"needsAdjusting","options":["addTime","moveDate"]}"""),
                ),
        )

        compose.onNodeWithText("Too tight").assertIsDisplayed()
        compose.onNodeWithText("Your plan no longer fits in the time left.").assertIsDisplayed()
        compose.onNodeWithText("Adjust").performClick()

        assertEquals(listOf<PlanSection?>(null), adjusted)
    }

    @Test
    fun anotherPhaseOpensOnTap() {
        show()

        compose.onNodeWithText("Python basics").performClick()

        compose.onNodeWithText("Variables and types").assertIsDisplayed()
    }

    @Test
    fun resumeWaitsForWhatResumingChanges() {
        show(status = "paused", resume = Resume.Pending)

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Resume this goal").assertIsNotEnabled()
    }

    @Test
    fun aLanguageGoalKeepsItsPaceWhileItsLevelLoads() {
        show(kind = "language")

        compose.onNodeWithText("Behind").assertIsDisplayed()
        compose.onNodeWithText("Progress").assertDoesNotExist()
    }

    @Test
    fun theProgressTileCountsTheLessonsStudiedWhileItsPercentStillCountsTheKnownOnes() {
        show(standing = Standing.Progress(progress(), done = 1_282, known = 25, total = 2_564))

        compose.onNodeWithText("1,257 lessons studied").assertIsDisplayed()
        compose.onNodeWithText("50%").assertIsDisplayed()
    }

    @Test
    fun theProgressTileSaysOneLessonStudied() {
        show(standing = Standing.Progress(progress(), done = 25, known = 24, total = 1_257))

        compose.onNodeWithText("1 lesson studied").assertIsDisplayed()
    }

    @Test
    fun theProgressTileSaysWhenNoLessonIsStudiedYet() {
        show(standing = Standing.Progress(progress(), done = 24, known = 24, total = 1_257))

        compose.onNodeWithText("No lessons studied yet").assertIsDisplayed()
    }

    @Test
    fun aSlotWithNothingToSuggestTakesNoPlaceOnThePage() {
        show(plan = learnPlan().copy(status = null))

        val list = compose.onNode(hasScrollToKeyAction()).fetchSemanticsNode().config[SemanticsProperties.IndexForKey]
        assertEquals(0, list("header"))
        assertEquals(-1, list("suggestion"))
    }

    @Test
    fun aPlanWithSubjectsListsThemInPlaceOfThePathAndOpensThem() {
        show(structure = modulesSyllabus())

        compose.onNodeWithText("Sets and tuples").assertDoesNotExist()
        compose.onNodeWithText("Working with data").performScrollTo().performClick()

        compose.runOnIdle { assertEquals(AppRoute.Subject("data"), navigator.currentRoute) }
    }

    private fun hasClickLabel(label: String) =
        SemanticsMatcher("click label $label") { it.config.getOrNull(SemanticsActions.OnClick)?.label == label }
}
