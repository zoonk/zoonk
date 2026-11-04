package com.zoonk.android.feature.essay

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextInputSelection
import androidx.compose.ui.text.TextRange
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class EssayDraftFoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val drafts = TemporaryFolder()

    private val text = (1..40).joinToString("\n") { "Parágrafo $it sobre a mobilidade urbana." }

    /** Unfolding and folding recreate the activity, and the fold moves the box to the page after it, beside its Send. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun theDraftKeepsItsTextCursorAndScrollThroughAFold() {
        val read = essay(withTexts = false)
        val viewModel = essayViewModel(read, drafts.root)
        val restoration = StateRestorationTester(rule)
        restoration.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                EssayWrite(read, ui, finishing = false, finishFailed = false, viewModel, rememberAppNavigator())
            }
        }
        val cursor = TextRange(text.length / 2)
        box().performTextInput(text)
        box().performTextInputSelection(cursor)
        page().performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, -SCROLL_ALL) }
        page().performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, SCROLLED) }
        val scrolled = page().scrollValue()

        restoration.emulateSavedInstanceStateRestore()
        publish(fold = true)
        box().assert(hasText(text)).assertSelection(cursor)

        restoration.emulateSavedInstanceStateRestore()
        publish(fold = false)
        box().assert(hasText(text)).assertSelection(cursor)
        assertEquals(scrolled, page().scrollValue())
    }

    private fun box() = rule.onNode(hasSetTextAction())

    private fun page() = rule.onNode(hasScrollAction() and hasAnyDescendant(hasSetTextAction()))

    private fun SemanticsNodeInteraction.scrollValue() = fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()

    private fun SemanticsNodeInteraction.assertSelection(range: TextRange) =
        assertEquals(range, fetchSemanticsNode().config[SemanticsProperties.TextSelectionRange])

    private fun publish(fold: Boolean) {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOfNotNull(
                    FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
                        .takeIf { fold },
                ),
            ),
        )
        rule.waitForIdle()
    }

    private companion object {
        const val SCROLL_ALL = 100_000f
        const val SCROLLED = 200f
    }
}
