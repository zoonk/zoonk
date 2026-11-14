package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.SpeakingPaper
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/** A locked task's Start turns into the gate, which keeps the task's Last result, until a purchase opens the paper. */
@RunWith(AndroidJUnit4::class)
class SpeakingGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val paper = mutableStateOf(paper("plusRequired"))

    @Test
    fun theGateKeepsLastResultAndAPurchaseLiftsIt() {
        rule.setContent {
            ZoonkTheme {
                SpeakingPaperSection(
                    paper = paper.value,
                    goalId = UUID.randomUUID(),
                    openTask = "1",
                    start = callStarter { error("A locked task never starts a call") },
                    open = {},
                    openWeb = {},
                )
            }
        }
        rule.onNodeWithText("Start").performClick()

        rule.onNodeWithText("Subscribe").assertExists()
        rule.onNodeWithText("Last result").assertExists()

        paper.value = paper("open")

        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        rule.onNodeWithText("Start").assertExists()
        rule.onNodeWithText("Last result").assertExists()
    }

    private fun paper(access: String): SpeakingPaper =
        ApiJson.decodeFromString(
            """
            {"exam":"dele","language":"es","level":"B2","paper":"oral","source":"https://example.com","title":"DELE B2",
             "access":"$access","minutes":{"min":15,"max":20},"prepMinutes":0,"prepTasks":[],
             "tasks":[{"key":"1","minutes":{"min":6,"max":7},"mode":"monologue","name":"Tarea 1","options":1,"prepMinutes":0,
               "prepShared":null,"role":"examiner","stimulus":"topic","criteria":[{"key":"fluency","name":"Fluidez"}],
               "lastTry":{"atLevel":1,"conversationId":"00000000-0000-4000-8000-0000000000c2","nearLevel":0,"rated":2}}]}
            """.trimIndent(),
        )
}
