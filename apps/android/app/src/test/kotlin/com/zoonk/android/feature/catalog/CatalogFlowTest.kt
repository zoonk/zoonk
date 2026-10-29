package com.zoonk.android.feature.catalog

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CatalogFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeCatalogApi()
    private lateinit var navigator: AppNavigator

    private fun show(
        session: AuthenticatedSession? = null,
        content: @Composable (AppContainer, AppNavigator, CatalogStore) -> Unit,
    ) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val store =
                    remember {
                        CatalogStore(
                            api,
                            AppCache(FakeSession(session), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                        )
                    }
                navigator = rememberAppNavigator()
                content(app, navigator, store)
            }
        }
    }

    private fun scrollTo(text: String) {
        rule.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun aCoursesFirstQuestionOpensTheLessonWithTheAnswer() {
        show { app, navigator, store -> CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, store) }

        rule.onNodeWithText("See what matter is made of.").assertIsDisplayed()
        scrollTo("No, it's more like a cloud")
        rule.onNodeWithText("No, it's more like a cloud").performClick()

        assertEquals(AppRoute.Lesson(LESSON_TWO, firstAnswer = "cloud"), navigator.currentRoute)
    }

    @Test
    fun buildMyPlanStartsTheCourseAtTheExamplesTimeADay() {
        show { app, navigator, store -> CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, store) }

        rule.onNodeWithText("Build my plan").performClick()

        assertEquals(AppRoute.CourseStart(COURSE, dailyMinutes = 15), navigator.currentRoute)
    }

    @Test
    fun theOutlineOpensAChapterInThisCourse() {
        show { app, navigator, store -> CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, store) }

        scrollTo("Beginner")
        rule.onNodeWithText("Beginner").performClick()
        scrollTo("Sharing electrons")
        rule.onNodeWithText("Bonds").performClick()

        assertEquals(AppRoute.CatalogChapter(CHAPTER_TWO, COURSE), navigator.currentRoute)
    }

    @Test
    fun aLaterChapterStartsThePlanFromItself() {
        show { app, navigator, store -> ChapterScreen(AppRoute.CatalogChapter(CHAPTER_TWO, COURSE), app, navigator, store) }

        rule.onNodeWithText("With Zoonk, your plan starts at this chapter and fits your schedule.").assertIsDisplayed()
        rule.onNodeWithText("Build my plan").performClick()

        assertEquals(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_TWO), navigator.currentRoute)
    }

    @Test
    fun aLessonsPageAsksItsFirstQuestion() {
        show { app, navigator, store -> LessonScreen(AppRoute.CatalogLesson(LESSON_TWO, CHAPTER_ONE, COURSE), app, navigator, store) }

        rule.onNodeWithText("Why the planet picture fails.").assertIsDisplayed()
        scrollTo("Yes, like a tiny planet")
        rule.onNodeWithText("Yes, like a tiny planet").performClick()

        assertEquals(AppRoute.Lesson(LESSON_TWO, firstAnswer = "planet"), navigator.currentRoute)
    }

    @Test
    fun aLessonTheLearnerStartedOffersToContinueIt() {
        api.startedLessons = setOf(LESSON_TWO)
        show(AuthenticatedSession("account", "token", "local")) { app, navigator, store ->
            LessonScreen(AppRoute.CatalogLesson(LESSON_TWO, CHAPTER_ONE, COURSE), app, navigator, store)
        }

        rule.onNodeWithText("You've started this lesson. It picks up where you left off.").assertIsDisplayed()
        rule.onNodeWithText("Yes, like a tiny planet").assertDoesNotExist()
        rule.onNodeWithText("Continue the lesson").performClick()

        assertEquals(AppRoute.Lesson(LESSON_TWO), navigator.currentRoute)
    }

    @Test
    fun aChapterTheCourseNoLongerHasIsNotFound() {
        show {
            app,
            navigator,
            store,
            ->
            ChapterScreen(AppRoute.CatalogChapter("99999999-9999-4999-8999-999999999999", COURSE), app, navigator, store)
        }

        rule.onNodeWithText("We couldn't find this page").assertIsDisplayed()
    }

    @Test
    fun aCategoryFiltersTheListInPlace() {
        show { app, navigator, store -> CatalogScreen(AppRoute.Catalog(), app, navigator, store) }

        rule.onNodeWithText("Course 1").assertIsDisplayed()
        rule.onNodeWithText("Math").performClick()

        rule.onNodeWithText("Courses in Math").assertIsDisplayed()
        assertTrue("courses:en:math:null" in api.reads)
        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun anEmptyCategoryIsntOffered() {
        show { app, navigator, store -> CatalogScreen(AppRoute.Catalog(), app, navigator, store) }

        rule.onNodeWithText("Math").assertIsDisplayed()
        rule.onNodeWithText("Law").assertDoesNotExist()
    }
}
