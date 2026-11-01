package com.zoonk.android.feature.player.language

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.player.FakeLessonPlayerApi
import com.zoonk.android.feature.player.LESSON_ID
import com.zoonk.android.feature.player.LessonPlayer
import com.zoonk.android.feature.player.LessonPlayerExits
import com.zoonk.android.feature.player.LessonPlayerStore
import com.zoonk.android.feature.player.LessonPlayerViewModel
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.playable
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepPart
import com.zoonk.android.feature.player.summaryStep
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** A learner answering each language screen, through the real player and what it sends to check. */
@RunWith(AndroidJUnit4::class)
class LanguageStepsFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
    private lateinit var api: FakeLessonPlayerApi

    private val exits =
        object : LessonPlayerExits {
            override fun close() = Unit

            override fun open(route: AppRoute) = Unit

            override fun replace(route: AppRoute) = Unit
        }

    private fun play(steps: List<LessonStep>) {
        val lesson = playable(steps).copy(language = "en", targetLanguage = "es")
        api = FakeLessonPlayerApi(LessonLoad.Ready(lesson))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(session, scope)
        val drafts = DraftStore(folder.newFolder(), scope, io = Dispatchers.Main.immediate)
        runBlocking { drafts.follow { DraftsChange(ANA) } }
        val viewModel =
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = null,
                firstAnswer = null,
                store = LessonPlayerStore(api, cache),
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                isGuest = { false },
                activeGoalId = { null },
                saved = SavedStateHandle(),
            )

        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalLessonSpeech provides previewSpeech(),
                ) {
                    val state by viewModel.state.collectAsState()
                    val ending by viewModel.ending.collectAsState()
                    LaunchedEffect(Unit) { viewModel.open(lesson) }
                    LessonPlayer(lesson, state, ending, viewModel, exits, rememberAppNavigator())
                }
            }
        }
        rule.waitUntil { viewModel.state.value?.run is LessonRun.Started }
    }

    private fun tap(text: String) =
        rule
            .onAllNodesWithText(text)
            .onFirst()
            .performClick()

    /** What the player sent for [stepId], as the API reads it. */
    private fun sent(stepId: String): JsonElement {
        rule.waitForIdle()
        val input = api.checks.last { it.first == stepId }.second
        return Json.parseToJsonElement(ApiJson.encodeToString(input)).jsonObject.getValue("answer")
    }

    @Test
    fun aWrongPairFlashesAndCountsThenEveryPairIsSentWithTheMistakes() {
        play(listOf(matchColumns("pairs"), summaryStep("end")))

        rule.onNodeWithText("Match the pairs.").assertIsDisplayed()
        tap("hola")
        tap("cat")
        rule.mainClock.advanceTimeBy(1_000)
        tap("hola")
        tap("hello")
        tap("gato")
        tap("cat")
        tap("Check")

        assertEquals(
            Json.parseToJsonElement(
                """{"kind":"matchColumns","mistakes":1,"userPairs":[{"left":"hola","right":"hello"},{"left":"gato","right":"cat"}]}""",
            ),
            sent("pairs"),
        )
    }

    @Test
    fun aSentenceBuiltBeforeTheAppClosedIsAnsweredAgainWhenItComesBack() {
        val restoration = StateRestorationTester(rule)
        var current by mutableStateOf<LessonAnswer?>(null)
        val actions =
            object : StepActions {
                override fun select(answer: LessonAnswer?) {
                    current = answer
                }

                override fun runPrimary() = Unit

                override fun dontKnow(stepId: String) = Unit

                override fun skipWriting() = Unit

                override fun explainFirst() = Unit

                override val cantTalk = false

                override fun setCantTalk(chosen: Boolean) = Unit

                override val cantListen = false

                override fun setCantListen(chosen: Boolean) = Unit

                override suspend fun gradeSpoken(
                    stepId: String,
                    recording: VoiceRecording,
                ) = GradeOutcome.Failed

                override fun exampleLine(stepId: String) = null
            }
        val content = reading("read").content as StepContent.Language
        restoration.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalLessonSpeech provides previewSpeech()) {
                    val language = rememberLessonLanguage("en", "es")
                    LanguageStepView(
                        content,
                        current,
                        result = null,
                        locked = false,
                        language = language,
                        actions = actions,
                        part = StepPart.Whole,
                    )
                }
            }
        }
        listOf("Yo", "veo", "un", "gato.").forEach(::tap)
        assertEquals(LessonAnswer.Reading(listOf("Yo", "veo", "un", "gato.")), current)

        // The process ends: the screen's saved words come back, the player's answer doesn't.
        current = null
        restoration.emulateSavedInstanceStateRestore()

        rule.waitForIdle()
        assertEquals(LessonAnswer.Reading(listOf("Yo", "veo", "un", "gato.")), current)
    }
}
