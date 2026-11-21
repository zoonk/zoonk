package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A listening mistake practiced again: "I can't listen now" stops the sentence the learner started. */
@RunWith(AndroidJUnit4::class)
class MistakeListeningTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val step =
        ApiJson.parseToJsonElement(
            """
            {"id":"4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","kind":"listening","position":2,
             "skillId":"5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","wordHints":null,
             "exercise":{"content":{},"fillBlankOptions":[],"id":"00000000-0000-4000-8000-000000000001","kind":"listening",
               "matchColumnsRightItems":[],"position":0,"readingPromptWords":[],
               "sentence":{"audioUrl":"http://127.0.0.1:9/sentence.mp3","distractors":[],"explanation":null,"id":"s-1",
                 "ordersPending":false,"otherSentenceOrders":[],"otherTranslationOrders":[],"romanization":null,
                 "sentence":"Tengo hambre.","translation":"I'm hungry.","translationDistractors":[]},
               "sentenceWordOptions":[],"translationOptions":[],"vocabularyOptions":[],"word":null,
               "wordBankOptions":[{"audioUrl":null,"romanization":null,"translation":null,"word":"I'm"},
                 {"audioUrl":null,"romanization":null,"translation":null,"word":"hungry."}]}}
            """.trimIndent(),
        )

    @Test
    fun switchingToTextStopsTheSentenceThatIsPlaying() {
        val entry = fixture("mistake-practice-lesson-entry")
        val lesson = entry.getValue("lesson").jsonObject
        val listening =
            JsonObject(
                entry + ("lesson" to JsonObject(lesson + mapOf("targetLanguage" to JsonPrimitive("es"), "step" to step))),
            )
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val viewModel = practiceViewModel(cache, FakeMistakesApi(practice(listening)))
        viewModel.started()
        val app = AppContainer.preview(rule.activity)

        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, app, navigator) }
            }
        }

        rule.onNodeWithText("Play").performClick()
        rule.waitForIdle()
        assertNotNull(app.speech.playback.value)

        rule.onNodeWithText("I can't listen now").performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText("I can listen now").assertExists()
        assertNull(app.speech.playback.value)
    }
}
