package com.zoonk.android.feature.mindmaps

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.isNotDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToIndex
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.PrivatePictures
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
import java.util.UUID

/** What a learner does with mind maps, against the real store and a fake API. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2400dp")
class MindMapFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)
    private val api = FakeMindMapApi()
    private val store = MindMapStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
    private var cap: Limit? = null
    private lateinit var navigator: AppNavigator

    private fun show(content: @Composable (MindMapsHost) -> Unit) {
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                val context = LocalContext.current
                val host =
                    remember {
                        MindMapsHost(
                            store,
                            ana,
                            PrivatePictures(AppContainer.preview(context).images, ana),
                            cap = { cap },
                            currentSession = { ana },
                        )
                    }
                content(host)
            }
        }
    }

    private fun showGrid() = show { MindMapsContent(goalId, it, navigator) }

    @Composable
    private fun Grid(subject: String) {
        ZoonkTheme {
            navigator = rememberAppNavigator()
            val context = LocalContext.current
            val host =
                remember {
                    MindMapsHost(
                        store,
                        ana,
                        PrivatePictures(AppContainer.preview(context).images, ana),
                        cap = { cap },
                        currentSession = { ana },
                    )
                }
            MindMapsContent(goalId, host, navigator, subject = subject)
        }
    }

    @Test
    fun aTapOnAFinishedChaptersTileDrawsItsMap() {
        showGrid()

        rule.onNodeWithText("Create").performClick()
        rule.waitForIdle()

        assertEquals(listOf(ChapterKey(goalId, UUID.fromString(mapChapter(3)))), api.created)
        rule.onAllNodesWithText("Drawing…").assertCountEquals(2)
    }

    @Test
    @Config(qualifiers = "w411dp-h480dp")
    fun mindMapsOpenedFromASubjectStartAtItsMaps() {
        rule.setContent { Grid(subject = "mathematics") }

        rule.onNodeWithText("Mathematics").assertIsDisplayed()
        assertTrue(rule.onNodeWithText("Pass ENEM").isNotDisplayed())
    }

    @Test
    @Config(qualifiers = "w411dp-h480dp")
    fun aReturnKeepsWhereTheLearnerScrolledInsteadOfJumpingBackToTheSubject() {
        val restoration = StateRestorationTester(rule)
        restoration.setContent { Grid(subject = "mathematics") }

        rule.onNode(hasScrollToIndexAction()).performScrollToIndex(0)
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText("Pass ENEM").assertIsDisplayed()
    }

    @Test
    fun eachTilesActionNamesItsChapterForTalkBack() {
        showGrid()

        rule.onNodeWithContentDescription("Create the mind map of Waves and sound").assertExists()
        rule.onNodeWithContentDescription("Try the mind map of Functions again").assertExists()
    }

    @Test
    fun aDrawnMapsTileNamesItsChapterOnce() {
        showGrid()

        rule.onNodeWithContentDescription("Mind map of Motion and forces").assertDoesNotExist()
        rule.onNodeWithText("Motion and forces").assertHasClickAction()
    }

    @Test
    fun aDrawnMapOpensFullScreen() {
        showGrid()

        rule.onNodeWithText("Motion and forces").performClick()

        assertEquals(AppRoute.MindMap(mapChapter(1)), navigator.currentRoute)
    }

    @Test
    fun aMapInWordsOpensItsChapter() {
        showGrid()

        rule.onNodeWithText("Energy").performClick()

        assertEquals(AppRoute.Chapter(mapChapter(2)), navigator.currentRoute)
    }

    @Test
    fun aFreePlanOutOfMapsSaysWhenTheyComeBackAndOffersPlus() {
        cap = Limit.Reached(LimitTier.Free, LimitPeriod.Day)
        showGrid()

        rule.onNodeWithText("Create").assertIsNotEnabled()
        rule.onNodeWithText("See Plus").performClick()

        assertEquals(AppRoute.Subscription, navigator.currentRoute)
    }

    @Test
    fun withoutMapsYetItSaysWhenTheFirstComesAndContinuesThere() {
        api.mindMaps =
            { goalMindMaps(emptyList(), next = """{"chapterId":"${mapChapter(3)}","lessonsLeft":2,"title":"Waves and sound"}""") }
        showGrid()

        rule.onNodeWithText("Your first one comes after Waves and sound: 2 lessons left.").assertIsDisplayed()
        rule.onNodeWithText("Continue").performClick()

        assertEquals(AppRoute.Chapter(mapChapter(3)), navigator.currentRoute)
    }

    @Test
    fun aChaptersCardDrawsItsMapOnATap() {
        show { MindMapCard(chapterMindMap("available"), ChapterKey(goalId, UUID.fromString(mapChapter(3))), it, navigator) }

        rule.onNodeWithText("Create the mind map").performClick()
        rule.waitForIdle()

        assertEquals(1, api.created.size)
        rule.onNodeWithText("Drawing the mind map…").assertIsDisplayed()
    }

    @Test
    fun aChaptersDrawnMapOpensFullScreen() {
        show { MindMapCard(chapterMindMap("ready"), ChapterKey(goalId, UUID.fromString(mapChapter(3))), it, navigator) }

        rule.onNodeWithText("Full screen").performClick()

        assertEquals(AppRoute.MindMap(mapChapter(3)), navigator.currentRoute)
    }

    @Test
    fun talkBackReadsAChaptersMapInWords() {
        show { MindMapCard(chapterMindMap("ready"), ChapterKey(goalId, UUID.fromString(mapChapter(3))), it, navigator) }

        rule.onNodeWithContentDescription("Frequency and pitch", substring = true).assertExists()
        rule.onNodeWithContentDescription("In short: A wave is energy on the move", substring = true).assertExists()
    }

    @Test
    fun talkBackReadsTheMapInWordsInAPhonesViewer() {
        val map = chapterMindMap("ready")
        show { MindMapViewer(ViewedMap(map.title, map.image!!, map.outline), onClose = {}, onSave = {}) }

        rule.onNodeWithContentDescription("High frequency, high pitch", substring = true).assertExists()
    }

    @Test
    fun theViewersButtonsZoomAndFitAgain() {
        val map = chapterMindMap("ready")
        show { MindMapViewer(ViewedMap(map.title, map.image!!, map.outline), onClose = {}, onSave = {}) }

        rule.onNodeWithContentDescription("Zoom in").performClick()
        rule.onNodeWithText("160%").assertIsDisplayed()
        rule.onNodeWithContentDescription("Fit to screen").performClick()
        rule.onNodeWithText("100%").assertIsDisplayed()
    }
}
