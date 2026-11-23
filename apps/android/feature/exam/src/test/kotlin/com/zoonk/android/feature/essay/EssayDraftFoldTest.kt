package com.zoonk.android.feature.essay

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextInputSelection
import androidx.compose.ui.text.TextRange
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.closeBook
import com.zoonk.android.ui.scaffold.unfoldBook
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

    private val text = (1..40).joinToString("\n") { "Paragraph $it about public control." }

    /** Unfolding and folding recreate the activity and move the question beside the field: the answer and its cursor stay. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun theAnswerKeepsItsTextAndCursorThroughAFold() {
        val api = FakeEssayApi(essay())
        val viewModel = essayViewModel(api, drafts.root)
        viewModel.startWriting()
        val restoration = StateRestorationTester(rule)
        restoration.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                WriteScreen(api.read, ui, viewModel, rememberAppNavigator())
            }
        }
        val cursor = TextRange(text.length / 2)
        field().performTextInput(text)
        field().performTextInputSelection(cursor)

        restoration.emulateSavedInstanceStateRestore()
        rule.unfoldBook(folds)
        field().assert(hasText(text)).assertSelection(cursor)

        restoration.emulateSavedInstanceStateRestore()
        rule.closeBook(folds)
        field().assert(hasText(text)).assertSelection(cursor)
    }

    private fun field() = rule.onNode(hasSetTextAction())

    private fun SemanticsNodeInteraction.assertSelection(range: TextRange) =
        assertEquals(range, fetchSemanticsNode().config[SemanticsProperties.TextSelectionRange])
}
