package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExamTaskTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val harness = ConversationHarness()

    private fun show() = compose.setContent { ZoonkTheme { harness.Conversation() } }

    @Test
    fun anotherTryWhoseCardIsntWrittenWaitsOnItsRunAndCanBeTriedAgain() {
        harness.api.stored =
            examConversation(harness.id, result = """{"brainPower":0,"passed":false,"spokenSeconds":0,"stars":0,"feedback":null}""")
        harness.api.writings += "run-1"
        harness.runs.finishes = false
        show()

        compose.onNodeWithText("Try this task with a new card").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("This didn't finish").assertExists()
        compose.onNodeWithText("Try this task with a new card").assertDoesNotExist()

        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()
        assertEquals(2, harness.api.starts.size)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(harness.id.toString())), harness.opened)
    }
}
