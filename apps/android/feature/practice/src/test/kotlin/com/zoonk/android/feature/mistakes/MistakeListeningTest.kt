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
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.TodayChoice
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.shadows.ShadowLooper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

/** A listening mistake practiced again plays its sentence as it opens, unless the learner can't listen today. */
@RunWith(AndroidJUnit4::class)
class MistakeListeningTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession(ANA, "token", "local")
    private val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))

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

    private fun practiceListening(viewModel: MistakePracticeViewModel): AppContainer {
        viewModel.started()
        val app = AppContainer.preview(rule.activity)
        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, app, navigator) }
            }
        }
        rule.waitForIdle()
        return app
    }

    private fun listeningMistake(): FakeMistakesApi {
        val entry = fixture("mistake-practice-lesson-entry")
        val lesson = entry.getValue("lesson").jsonObject
        val listening = JsonObject(lesson + mapOf("targetLanguage" to JsonPrimitive("es"), "step" to step))
        return FakeMistakesApi(practice(JsonObject(entry + ("lesson" to listening))))
    }

    @Test
    fun theSentencePlaysAsTheQuestionOpensAndStopsWhenTheLearnerSwitchesToText() {
        val app = practiceListening(practiceViewModel(cache, listeningMistake()))
        assertNotNull(app.speech.playback.value)

        rule.onNodeWithText("I can't listen now").performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText("I can listen now").assertExists()
        assertNull(app.speech.playback.value)
    }

    @Test
    fun aLearnerWhoCantListenTodayHearsNothingWhileTheirChoiceIsRead() {
        val directory = folder.newFolder()
        val earlier = DraftStore(directory, CoroutineScope(SupervisorJob() + Dispatchers.IO))
        runBlocking {
            earlier.follow { DraftsChange(ANA) }
            TodayChoices(earlier).set(ana, TodayChoice.CantListen, true)
            earlier.follow { DraftsChange(null) }
        }
        // The app opens again, so the choice is read from disk, which is slow today.
        val disk = Executors.newSingleThreadExecutor()
        val io = disk.asCoroutineDispatcher()
        val drafts = DraftStore(directory, CoroutineScope(SupervisorJob() + io), io)
        runBlocking { drafts.follow { DraftsChange(ANA) } }
        val slowDisk = CountDownLatch(1)
        disk.execute { slowDisk.await() }
        val viewModel = practiceViewModel(cache, listeningMistake(), choices = TodayChoices(drafts), sessions = FakeSession(ana))

        val app = practiceListening(viewModel)
        assertNull(app.speech.playback.value)

        slowDisk.countDown()
        // The disk answers on its own thread, in real time rather than on the test's clock.
        val deadline = System.currentTimeMillis() + 5_000
        while (!viewModel.todayChoicesRead && System.currentTimeMillis() < deadline) {
            ShadowLooper.idleMainLooper()
            Thread.sleep(10)
        }
        rule.waitForIdle()
        rule.onNodeWithText("I can listen now").assertExists()
        assertNull(app.speech.playback.value)
        disk.shutdown()
    }
}
