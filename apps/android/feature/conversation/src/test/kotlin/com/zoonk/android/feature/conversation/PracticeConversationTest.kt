package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguagePracticeCall
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class PracticeConversationTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val chapter = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000c2")
    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()

    private fun show(start: CallStarter) {
        compose.setContent {
            ZoonkTheme {
                PracticeConversation(
                    call = practiceCall(),
                    chapterId = chapter,
                    goalId = null,
                    start = start,
                    open = { opened += it },
                )
            }
        }
        compose.onNodeWithText("Practice a conversation").performClick()
    }

    @Test
    fun aCallBeingWrittenShowsItsWaitThenStartsAgainAndOpensOnceWritten() {
        val runs = HeldRuns()
        val answers = ArrayDeque(listOf<CallStart>(CallStart.Writing("run-1"), CallStart.Started(started)))
        show(start = starting(answers, runs))
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Your call opens as soon as it's ready.").assertExists()
        assertEquals(1, requests.size)

        runs.write()
        compose.waitForIdle()
        assertEquals(2, requests.size)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    private fun starting(
        answers: ArrayDeque<CallStart>,
        runs: GenerationSource,
    ) = callStarter(runs) { request ->
        requests += request
        answers.removeFirst()
    }
}

private fun practiceCall(): LanguagePracticeCall =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]}
        """.trimIndent(),
    )
