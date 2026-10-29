package com.zoonk.android.feature.goalcontent

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.datetime.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** What a learner does on a subject's and a chapter's pages, against the real stores and fake APIs. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2400dp")
class GoalContentFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val goalId = UUID.fromString(GOAL)
    private val api = FakeGoalContentApi()
    private val cache =
        AppCache(
            FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    private val store = GoalContentStore(api, cache, timeZone = { TimeZone.UTC })
    private val planApi = FakePlanApi()
    private val plans = PlanStore(SyllabusPlanApi(planApi), cache)
    private lateinit var navigator: AppNavigator

    private fun showSubject(
        key: String,
        mindMapChapters: Set<UUID> = emptySet(),
    ) {
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                SubjectContent(goalId, key, plans.syllabus[goalId], plans, navigator, mindMapChapters = { mindMapChapters })
            }
        }
    }

    private fun showChapter() {
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                ChapterContent(ChapterKey(goalId, UUID.fromString(chapterId(3))), store, navigator)
            }
        }
    }

    @Test
    fun continueOpensTheSubjectsNextChapter() {
        showSubject("natural-sciences")

        rule.onNodeWithText("Continue").performClick()

        assertEquals(AppRoute.Chapter(chapterId(3)), navigator.currentRoute)
    }

    @Test
    fun aChapterRowOpensItsChapter() {
        showSubject("natural-sciences")

        rule.onNodeWithText("4. Electricity").performClick()

        assertEquals(AppRoute.Chapter(chapterId(4)), navigator.currentRoute)
    }

    @Test
    fun theChaptersDoneOpenUnderTheirLine() {
        showSubject("natural-sciences")

        rule.onNodeWithText("1 chapter done, 1 skipped because you already know it").performClick()
        rule.onNodeWithText("1. Motion and forces").performClick()

        assertEquals(AppRoute.Chapter(chapterId(1)), navigator.currentRoute)
    }

    @Test
    fun moreChaptersShowsTheRestWithAFarTopicsLessonsAndStart() {
        showSubject("natural-sciences")

        rule.onNodeWithText("2 more chapters").performClick()

        rule.onNodeWithText("8. Genetics").assertIsDisplayed()
        rule.onNodeWithText("About 6 lessons").assertIsDisplayed()
    }

    @Test
    fun aTopicOpensToItsSubtopicsAndTheChaptersTeachingIt() {
        showSubject("natural-sciences")

        rule.onNodeWithText("1 Mechanics").performClick()
        rule.onNodeWithText("1.1 Kinematics").assertIsDisplayed()
        rule.onNodeWithText("Motion and forces").performClick()

        assertEquals(AppRoute.Chapter(chapterId(1)), navigator.currentRoute)
    }

    @Test
    fun aSubjectTakenOutComesBackWithItsAreas() {
        showSubject("spanish")

        rule.onNodeWithText("You took this subject out of your plan.").assertIsDisplayed()
        rule.onNodeWithText("Bring it back").performClick()
        rule.waitForIdle()

        assertEquals(listOf<PlanOp>(PlanOp.RestoreAreas(listOf("Spanish"))), planApi.changes.single())
    }

    @Test
    fun aWrittenTestsPageSavesWhenItsPracticed() {
        showSubject("essay")

        rule.onNodeWithText("Every week").assertIsSelected()
        rule.onNodeWithText("Every other week").performClick()
        rule.waitForIdle()

        assertEquals(listOf<PlanOp>(PlanOp.WrittenCadence("biweekly")), planApi.changes.single())
    }

    @Test
    fun aSubjectWithFinishedChaptersLeadsToTheirMindMaps() {
        showSubject("natural-sciences", mindMapChapters = setOf(UUID.fromString(chapterId(1))))

        rule.onNodeWithText("Mind maps").performClick()

        assertEquals(AppRoute.MindMaps(), navigator.currentRoute)
    }

    @Test
    fun aSubjectWithoutMindMapsDoesntOfferThem() {
        showSubject("natural-sciences", mindMapChapters = setOf(UUID.fromString(chapterId(42))))

        rule.onNodeWithText("Mind maps").assertDoesNotExist()
    }

    @Test
    fun aSubjectThePlanDoesntHaveIsNotFound() {
        showSubject("history")

        rule.onNodeWithText("We couldn't find this page").assertIsDisplayed()
    }

    @Test
    fun continueOpensTheChaptersNextLesson() {
        showChapter()

        rule.onNodeWithText("Continue").performClick()

        assertEquals(AppRoute.Lesson(lessonId(3)), navigator.currentRoute)
    }

    @Test
    fun aLessonRowOpensThatLesson() {
        showChapter()

        rule.onNodeWithText("4. The Doppler effect").performClick()

        assertEquals(AppRoute.Lesson(lessonId(4)), navigator.currentRoute)
    }

    @Test
    fun alreadyKnowingItOpensTheTest() {
        showChapter()

        rule.onNodeWithText("Already know this?").performClick()

        assertEquals(AppRoute.TestOut(chapterId(3)), navigator.currentRoute)
    }

    @Test
    fun practicingTheChapterOpensItsBlock() {
        showChapter()

        rule.onNodeWithText("Practice this chapter").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.QuestionBlock(sessionId = SESSION, blockId = BLOCK), navigator.currentRoute)
    }

    @Test
    fun practiceUsedUpForTheDaySaysWhenItComesBack() {
        api.practice = { throw ApiException(ApiError.Unavailable, status = 409) }
        showChapter()

        rule.onNodeWithText("Practice this chapter").performClick()

        rule.onNodeWithText("That's all the bonus practice for today. Tomorrow's session picks this chapter up.").assertIsDisplayed()
        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun theChapterSummaryOpensToItsSkillsAndIdeas() {
        showChapter()

        rule.onNodeWithText("Chapter summary").performClick()

        rule.onNodeWithText("Relate frequency to pitch").assertIsDisplayed()
        rule.onNodeWithText("To review").assertIsDisplayed()
    }
}
