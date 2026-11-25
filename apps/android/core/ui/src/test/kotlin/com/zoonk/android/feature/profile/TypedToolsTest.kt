package com.zoonk.android.feature.profile

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewOptionsInner
import com.zoonk.api.models.ProfileQuestionViewSaved
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The tools field clears the names it turns into chips, and that reset must not undo the chips. */
@RunWith(AndroidJUnit4::class)
class TypedToolsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val question =
        ProfileQuestionView(
            ProfileQuestion.TOOLS,
            listOf(ProfileQuestionViewOptionsInner(null, "excel", "Excel")),
            ProfileQuestionViewSaved(emptyList(), emptyList(), ""),
            null,
            1,
        )

    private var draft by mutableStateOf(ProfileDraft())

    private fun show() {
        compose.setContent { ZoonkTheme { ProfileQuestionBody(question, draft, { draft = it }) } }
        compose.waitForIdle()
    }

    @Test
    fun aCommaTurnsWhatWasTypedIntoChips() {
        show()

        compose.onNode(hasSetTextAction()).performTextInput("Notion, excel, ")
        compose.waitForIdle()

        assertEquals(ProfileDraft(picks = listOf("excel"), typed = listOf("Notion")), draft)
    }

    @Test
    fun addTurnsWhatWasTypedIntoAChip() {
        show()

        compose.onNode(hasSetTextAction()).performTextInput("Notion")
        compose.waitForIdle()
        compose.onNodeWithText("Add").performClick()
        compose.waitForIdle()

        assertEquals(ProfileDraft(typed = listOf("Notion")), draft)
    }

    @Test
    fun anEditRightAfterAddKeepsTheChip() {
        show()

        compose.onNode(hasSetTextAction()).performTextInput("Notion")
        compose.waitForIdle()
        val add = compose.onNodeWithText("Add").fetchSemanticsNode().config
        val field = compose.onNode(hasSetTextAction()).fetchSemanticsNode().config
        compose.runOnUiThread {
            add[SemanticsActions.OnClick].action!!()
            field[SemanticsActions.InsertTextAtCursor].action!!(AnnotatedString("X"))
        }
        compose.waitForIdle()

        assertEquals(ProfileDraft(text = "X", typed = listOf("Notion")), draft)
    }
}
