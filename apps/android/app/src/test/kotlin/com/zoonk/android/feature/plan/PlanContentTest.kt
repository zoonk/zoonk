package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollToKeyAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.goalcontent.modulesSyllabus
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.Plan
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

    private fun show(
        status: String = "active",
        resumeChangesPlan: Boolean = false,
        kind: String = "learn",
        resume: Resume = if (resumeChangesPlan) Resume.Confirm else Resume.Plain,
        structure: Syllabus? = null,
        plan: Plan = learnPlan(),
    ) {
        val summary = learnerSummary(status = status, kind = kind)
        val page = PlanPageState(summary.goals.first(), plan, summary)
        compose.setContent {
            navigator = rememberAppNavigator()
            ZoonkTheme {
                PlanContent(
                    page = page,
                    standing = if (kind == "language") null else Standing.Progress(progress(), done = 13, total = 46),
                    structure = structure,
                    links = PlanLinks(navigator, page, openFarTopic = { farTopics += it }),
                    resume = resume,
                    isSaving = false,
                    onSetStatus = { statuses += it },
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
    fun aLanguageGoalKeepsItsPaceWhileItsLevelLoadsElsewhere() {
        show(kind = "language")

        compose.onNodeWithText("Behind").assertIsDisplayed()
        compose.onNodeWithText("Progress").assertDoesNotExist()
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
}
