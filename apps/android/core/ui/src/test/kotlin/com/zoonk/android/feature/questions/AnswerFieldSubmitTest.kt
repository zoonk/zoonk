package com.zoonk.android.feature.questions

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Done sends what the field holds when it's pressed, even when an edit lands in the same frame. */
@RunWith(AndroidJUnit4::class)
class AnswerFieldSubmitTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun doneSubmitsWhatTheFieldHoldsBeforeTheNextFrame() {
        var submitted: Answer? = null
        compose.setContent { ZoonkTheme { TypedAnswerField(null, true, onAnswer = {}, onSubmit = { submitted = it }) } }
        typeThenDoneInOneFrame("Pari", "s")
        assertEquals(Answer.Text("Paris"), submitted)
    }

    @Test
    fun doneSubmitsTheWholeNumberBeforeTheNextFrame() {
        var submitted: Answer? = null
        compose.setContent { ZoonkTheme { NumericAnswerField(null, null, null, true, onAnswer = {}, onSubmit = { submitted = it }) } }
        typeThenDoneInOneFrame("4", "2")
        assertEquals(Answer.Numeric(42.0), submitted)
    }

    private fun typeThenDoneInOneFrame(
        typed: String,
        last: String,
    ) {
        compose.onNode(hasSetTextAction()).performTextInput(typed)
        compose.waitForIdle()
        val node = compose.onNode(hasSetTextAction()).fetchSemanticsNode().config
        compose.runOnUiThread {
            node[SemanticsActions.InsertTextAtCursor].action!!(AnnotatedString(last))
            node[SemanticsActions.OnImeAction].action!!()
        }
    }
}
