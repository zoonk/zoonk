package com.zoonk.android.feature.catalog

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToKey
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** The catalog on an unfolded book foldable: a page on each side of the fold, and what phones and tablets keep. */
@RunWith(AndroidJUnit4::class)
class CatalogOpenBookTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeCatalogApi()

    /** A page [width] wide at the window's end, where the shell lays it beside an unfolded book's navigation rail. */
    @Composable
    private fun Page(
        width: Dp,
        content: @Composable (AppContainer, AppNavigator, CatalogStore) -> Unit,
    ) {
        ZoonkTheme {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val store =
                remember {
                    CatalogStore(api, AppCache(FakeSession(null), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
                }
            val navigator = rememberAppNavigator()

            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                Box(if (width == Dp.Unspecified) Modifier.fillMaxSize() else Modifier.width(width)) { content(app, navigator, store) }
            }
        }
    }

    private fun show(
        width: Dp = Dp.Unspecified,
        content: @Composable (AppContainer, AppNavigator, CatalogStore) -> Unit,
    ) = rule.setContent { Page(width, content) }

    private fun course(): @Composable (AppContainer, AppNavigator, CatalogStore) -> Unit =
        { app, navigator, store -> CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, store) }

    /** The book opened flat, its fold down the middle of the window. */
    private fun unfold() = publish(listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = VERTICAL)))

    private fun closeTheBook() = publish(emptyList())

    private fun publish(features: List<FoldingFeature>) {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(features))
        rule.waitForIdle()
    }

    /** Where [text] shows, scrolled into view in whichever list holds it. */
    private fun boundsOf(text: String): DpRect {
        val lists = rule.onAllNodes(hasScrollAction())
        val found =
            (0 until lists.fetchSemanticsNodes().size).any { index ->
                runCatching { lists[index].performScrollToNode(hasText(text)) }.isSuccess
            }
        assertTrue("a list holds “$text”", found)
        return rule.onNodeWithText(text).getUnclippedBoundsInRoot()
    }

    private fun assertBeforeFold(text: String) {
        val bounds = boundsOf(text)
        assertTrue("“$text” ends before the fold: $bounds", bounds.right <= FOLD)
    }

    private fun assertAfterFold(text: String) {
        val bounds = boundsOf(text)
        assertTrue("“$text” starts after the fold: $bounds", bounds.left >= FOLD)
    }

    private fun assertOneList() = rule.onAllNodes(hasScrollAction()).assertCountEquals(1)

    private fun level(title: String) = rule.onNode(hasText(title) and hasClickAction())

    private fun expanded(open: Boolean) =
        SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, if (open) "Expanded" else "Collapsed")

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookShowsTheCourseBeforeTheFoldAndWhatItCoversAfterIt() {
        show(BOOK_PAGE, course())

        unfold()

        assertBeforeFold("See what matter is made of.")
        assertBeforeFold("Does the electron circle the nucleus?")
        assertBeforeFold("Example plan")
        assertAfterFold("Who it's for")
        assertAfterFold("Course outline")
        assertAfterFold("Start today, at your level")
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookShowsTheChapterBeforeTheFoldAndItsLessonsAfterIt() {
        show(BOOK_PAGE) { app, navigator, store -> ChapterScreen(AppRoute.CatalogChapter(CHAPTER_TWO, COURSE), app, navigator, store) }

        unfold()

        assertBeforeFold("What Bonds covers.")
        assertBeforeFold("Does the electron circle the nucleus?")
        assertAfterFold("Where this chapter sits in the course")
        assertAfterFold("Lessons")
        assertAfterFold("What you'll learn")
        assertAfterFold("Your plan from this chapter")
    }

    /** Main pairs the lesson with its chapter's lessons where there's room; an open book pairs them at the fold. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookPairsTheLessonWithItsChapterAtTheFold() {
        show(
            BOOK_PAGE,
        ) { app, navigator, store -> LessonScreen(AppRoute.CatalogLesson(LESSON_TWO, CHAPTER_ONE, COURSE), app, navigator, store) }

        unfold()

        assertBeforeFold("Why the planet picture fails.")
        assertBeforeFold("Yes, like a tiny planet")
        assertAfterFold("This lesson is part of the Atoms course.")
        val chapter = rule.onAllNodesWithText("Inside the atom")
        val shown = chapter.fetchSemanticsNodes().size
        assertTrue("the chapter's lessons show", shown > 0)
        repeat(shown) { index ->
            val bounds = chapter[index].getUnclippedBoundsInRoot()
            assertTrue("the chapter starts after the fold: $bounds", bounds.left >= FOLD)
        }
        rule.onNodeWithText("Chapter 1: Inside the atom").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aPhoneKeepsTheCourseInOneColumn() {
        show(content = course())

        assertOneList()
        boundsOf("Example plan")
        boundsOf("Who it's for")
        boundsOf("Start today, at your level")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aTabletKeepsTheCourseInOneColumnWithTheLessonBesideItsHero() {
        show(content = course())

        assertOneList()
        assertTrue(
            "the lesson to try sits beside the hero",
            boundsOf("Does the electron circle the nucleus?").left > boundsOf("See what matter is made of.").right,
        )
        boundsOf("Start today, at your level")
    }

    /** Folding and unfolding recreate the window: the learner's place and the levels they opened come back on the page that holds them. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun unfoldingAndFoldingKeepTheLearnersPlaceAndWhatTheyOpened() {
        val restoration = StateRestorationTester(rule)
        restoration.setContent { Page(BOOK_PAGE, course()) }
        rule.onNode(hasScrollAction()).performScrollToKey("outline")
        level("Beginner").performClick()

        restoration.emulateSavedInstanceStateRestore()
        unfold()

        assertAtTop("Course outline")
        assertTrue("it's on the page after the fold", rule.onNodeWithText("Course outline").getUnclippedBoundsInRoot().left >= FOLD)
        level("Beginner").assert(expanded(true))
        rule.onNode(hasScrollAction() and hasAnyDescendant(hasText("See what matter is made of."))).assert(atItsTop())

        rule.onNode(hasScrollAction() and hasAnyDescendant(hasText("Course outline"))).performScrollToKey("closing")
        restoration.emulateSavedInstanceStateRestore()
        closeTheBook()

        assertOneList()
        rule.onNodeWithText("Start today, at your level").assertIsDisplayed()
        boundsOf("Beginner")
        level("Beginner").assert(expanded(true))
    }

    private fun atItsTop() =
        SemanticsMatcher("scrolled to its top") { it.config[SemanticsProperties.VerticalScrollAxisRange].value() == 0f }

    /** [text] leads its list's first screen, under the top app bar. */
    private fun assertAtTop(text: String) {
        val bounds = rule.onNodeWithText(text).getUnclippedBoundsInRoot()
        assertTrue("“$text” is at the top: $bounds", bounds.top < 240.dp)
    }

    private companion object {
        val VERTICAL = FoldingFeature.Orientation.VERTICAL

        /** A Pixel Fold's 852dp window less the 80dp rail. */
        val BOOK_PAGE = 772.dp
        val FOLD = 426.dp
    }
}
