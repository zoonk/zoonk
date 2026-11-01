package com.zoonk.android.feature.mock.result

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.runner.FakeMockRunApi
import com.zoonk.android.feature.mock.runner.ITEM_TWO
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.MockScreen
import com.zoonk.android.feature.mock.runner.RUN_BLOCK
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * A Galaxy Z Fold's inner display reads a mock's questions to review on the page after the fold, and
 * a phone in a sheet. Folding recreates the screen, so the question the learner was reading has to
 * come back in the other layout.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w707dp-h823dp")
class ReviewPlaceTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val restoration = StateRestorationTester(rule)

    @Test
    fun foldingMidReviewOpensTheSheetAtTheSameQuestion() {
        show()
        open()

        readFromTheTop(SIXTH)
        recreate()

        rule.onNode(isDialog()).assertExists()
        rule.onNodeWithText(SIXTH).assertIsDisplayed()
        rule.onNodeWithText(FIFTH).assertIsNotDisplayed()
    }

    /** Unfolding recreates the screen without its fold at first, so the sheet shows for a moment before the page does. */
    @Test
    fun theSheetsQuestionIsWhereThePageOpensAsTheBookUnfolds() {
        show()
        rule.onNodeWithText("See the 12 questions").performClick()
        rule.waitForIdle()

        readFromTheTop(SIXTH)
        recreate()
        rule.onNode(isDialog()).assertExists()
        rule.onNodeWithText(SIXTH).assertIsDisplayed()
        open()

        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText(SIXTH).assertIsDisplayed()
        rule.onNodeWithText(FIFTH).assertIsNotDisplayed()
    }

    @Test
    fun scrollingBackUpThePageMovesWhereTheSheetOpens() {
        show()
        rule.onNodeWithText("See the 12 questions").performClick()
        rule.waitForIdle()
        readFromTheTop(SIXTH)
        recreate()
        open()

        rule
            .onNode(
                hasScrollAction() and hasAnyDescendant(hasText(SIXTH)),
            ).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, -100_000f) }
        rule.waitForIdle()
        recreate()

        rule.onNode(isDialog()).assertExists()
        rule.onNodeWithText(FIRST).assertIsDisplayed()
    }

    /** A short review shows whole on the page after the fold, so it was never closed: folding again opens the sheet. */
    @Test
    fun aShortReviewStaysOpenThroughAnOpenBook() {
        show(questions = 1)
        rule.onNodeWithText("See the question").performClick()
        rule.waitForIdle()

        recreate()
        open()
        rule.onNode(isDialog()).assertDoesNotExist()
        recreate()

        rule.onNode(isDialog()).assertExists()
    }

    private fun show(questions: Int = 12) {
        val api =
            FakeMockRunApi(
                finishedMock(extra = """"purpose":"placement","review":[${(1..questions).joinToString(",") { statement(it) }}]"""),
            )
        restoration.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate) }
            val store =
                remember {
                    MockRunStore(
                        api,
                        AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
                        DraftStore(folder.root, scope),
                    ) {
                        "UTC"
                    }
                }
            ZoonkTheme { Surface { MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store) } }
        }
        // The result loads off the main thread, and window-testing tells a fold only to screens already showing.
        rule.waitUntil { rule.onAllNodesWithText("By area").fetchSemanticsNodes().isNotEmpty() }
    }

    private fun open() {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    /** Android recreates the screen as the book folds; window-testing tells the new one of no fold. */
    private fun recreate() {
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
    }

    /** Scrolls what holds [label] until it sits at the top, as a learner reading down the questions leaves it. */
    private fun readFromTheTop(label: String) {
        val list = rule.onNode(hasScrollAction() and hasAnyDescendant(hasText(label)))
        val top = list.fetchSemanticsNode().positionInRoot.y
        val question =
            rule
                .onNodeWithText(label)
                .fetchSemanticsNode()
                .positionInRoot.y
        list.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, question - top) }
        rule.waitForIdle()
        rule.onNodeWithText(label).assertIsDisplayed()
        rule.onNodeWithText(FIFTH).assertIsNotDisplayed()
    }

    private fun statement(number: Int) =
        """{"area":"Mathematics","citation":null,"context":null,"correctAnswer":"false","explanation":"The opposite holds.",
        "format":"trueFalse","itemId":"$ITEM_TWO","learnerAnswer":"true","number":$number,"outcome":"wrong",
        "question":"Statement $number holds.","set":null}"""

    private companion object {
        const val FIRST = "Question 1\u00A0· Mathematics"
        const val FIFTH = "Question 5\u00A0· Mathematics"
        const val SIXTH = "Question 6\u00A0· Mathematics"
    }
}
