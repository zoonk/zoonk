package com.zoonk.android.feature.catalog

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CourseResourceLevelsInner
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CourseOutlinePlaceTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private fun show(
        chapters: List<CourseChapter> = chapters(),
        levels: List<String> = listOf("overview", "beginner", "intermediate"),
        goal: LearnerSummaryGoal? = null,
        openLevel: CourseChapter.Level? = CourseChapter.Level.BEGINNER,
    ) {
        rule.setContent {
            ZoonkTheme {
                CourseOutline(
                    rememberAppNavigator(),
                    COURSE,
                    chapters,
                    course().examplePlan,
                    lead = null,
                    openLevel = openLevel,
                    levels = levels.map { level(it) },
                    goal = goal,
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                )
            }
        }
    }

    @Test
    fun aLevelWithNoChaptersIsAStillRowSayingItsWrittenLater() {
        show()

        rule
            .onNodeWithText("Intermediate")
            .performScrollTo()
            .assertIsDisplayed()
            .assertHasNoClickAction()
        rule.onNodeWithText("Not written yet. Zoonk writes its chapters as learners reach it.").assertIsDisplayed()
    }

    @Test
    fun theCountSaysTheLessonsWrittenSoFarAndNoHours() {
        show()

        rule.onNodeWithText("2 chapters · 3 lessons written so far").assertIsDisplayed()
    }

    @Test
    fun aLearnersChapterIsMarkedAndTheFoldHidingItOpens() {
        val many = (1..9).map { chapter(chapterId(it), "Chapter $it", "beginner", it, listOf(lessonId(it) to "Lesson $it")) }
        show(chapters = many, levels = listOf("beginner"), goal = goal(chapterId = chapterId(8), level = "beginner"))

        rule.onNodeWithText("Chapter 8").performScrollTo().assertIsDisplayed()
        rule.onAllNodesWithText("You are here").assertCountEquals(1)
    }

    @Test
    fun aLearnersLevelIsMarkedWhileNoChapterHoldsTheirNextLesson() {
        show(goal = goal(chapterId = null, level = "intermediate"))

        rule.onNodeWithText("You are here").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aLearnerWithAPlanOnTheCourseSeesNoExampleWeeks() {
        show(openLevel = CourseChapter.Level.OVERVIEW, goal = goal(chapterId = CHAPTER_ONE, level = "overview"))

        rule.onNodeWithText("Inside the atom").performScrollTo().assertIsDisplayed()
        rule.onAllNodes(hasText("week", substring = true, ignoreCase = true)).assertCountEquals(0)
        rule.onAllNodes(hasText("a day", substring = true)).assertCountEquals(0)
    }

    @Test
    fun someoneDecidingSeesTheExamplesWeeks() {
        show(openLevel = CourseChapter.Level.OVERVIEW)

        rule.onNodeWithText("Week 1").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun continueGoesToSetupTodayOrSwitchesToTheGoalFirst() {
        assertEquals(CourseContinue.Setup(GOAL.toString()), courseContinue(goal(setup = true, active = false)))
        assertEquals(CourseContinue.Today, courseContinue(goal(active = true)))
        assertEquals(CourseContinue.Switch(GOAL), courseContinue(goal(active = false)))
    }

    private companion object {
        val GOAL: UUID = UUID.fromString("7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")

        fun chapterId(n: Int) = "22222222-2222-4222-8222-2222222223%02d".format(n)

        fun lessonId(n: Int) = "33333333-3333-4333-8333-3333333334%02d".format(n)

        fun level(value: String): CourseResourceLevelsInner =
            ApiJson.decodeFromString("""{"level":"$value","written":${value != "intermediate"}}""")

        fun goal(
            chapterId: String? = null,
            level: String? = null,
            active: Boolean = true,
            setup: Boolean = false,
        ): LearnerSummaryGoal =
            ApiJson.decodeFromString(
                """
                {"courseChapterId":${chapterId?.let { "\"$it\"" } ?: "null"},"courseId":"$COURSE",
                 "courseLevel":${level?.let { "\"$it\"" } ?: "null"},"dailyMinutes":15,"id":"$GOAL","isActive":$active,
                 "isSettingUp":$setup,"kind":"learn","status":"active","targetDate":null,"targetLanguage":null,"title":"Atoms"}
                """.trimIndent(),
            )
    }
}
