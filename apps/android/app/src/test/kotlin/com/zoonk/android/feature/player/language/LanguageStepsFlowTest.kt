package com.zoonk.android.feature.player.language

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
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
import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.playable
import com.zoonk.android.feature.player.steps.StepActions
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

    private fun play(
        steps: List<LessonStep>,
        learner: String = "en",
    ) {
        val lesson = playable(steps).copy(language = learner, targetLanguage = "es")
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
            )

        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState(), LocalLessonSpeech provides previewSpeech()) {
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
    fun aSentenceIsBuiltFromTheBankAndAPlacedWordGoesBackOnATap() {
        play(listOf(reading("read"), summaryStep("end")))

        rule.onNodeWithText("see").assertIsDisplayed()
        tap("gato.")
        rule.onNodeWithContentDescription("Position 1: gato.").performClick()
        listOf("Yo", "veo", "un").forEach(::tap)
        rule.onNodeWithText("Check").assertIsNotEnabled()
        tap("gato.")
        tap("Check")

        assertEquals(
            Json.parseToJsonElement("""{"arrangedWords":["Yo","veo","un","gato."],"kind":"reading"}"""),
            sent("read"),
        )
        rule.onNodeWithText("Correct!").assertIsDisplayed()
    }

    @Test
    fun blanksFillInOrderAndATapEmptiesOne() {
        play(listOf(fillBlank("blank"), summaryStep("end")))

        rule.onNodeWithText("Fill in the blank").assertIsDisplayed()
        tap("rent")
        rule.onNodeWithContentDescription("Blank 1: rent").performClick()
        rule.onNode(hasContentDescription("Blank 1")).assertIsDisplayed()
        tap("pay")
        tap("Check")

        assertEquals(Json.parseToJsonElement("""{"kind":"fillBlank","userAnswers":["pay"]}"""), sent("blank"))
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

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun aWordIsReadThenItsTranslationIsPickedByTapOrNumberKey() {
        play(listOf(vocabulary("word"), translation("pick"), summaryStep("end")))

        rule.onNodeWithContentDescription("Vocabulary: gato").assertIsDisplayed()
        rule.onNodeWithText("cat").assertIsDisplayed()
        rule.onNodeWithText("You say it to a cat.").assertIsDisplayed()
        tap("Next")

        rule.onNodeWithText("Translate").assertIsDisplayed()
        rule.onNodeWithText("ga-to").assertIsDisplayed()
        rule.onRoot().performKeyInput { pressKey(Key.Two) }
        tap("Check")

        assertEquals(Json.parseToJsonElement("""{"kind":"translation","selectedOptionId":"w-1"}"""), sent("pick"))
    }

    @Test
    fun aLessonInTheLearnersOwnLanguageAsksWhichWordMeansThis() {
        play(listOf(translation("pick"), summaryStep("end")), learner = "es-MX")

        rule.onNodeWithText("Which one means this?").assertIsDisplayed()
    }

    @Test
    fun listeningWithoutItsRecordingShowsTheSentenceToTranslate() {
        play(listOf(listening("hear", audioUrl = null), listening("hear-2", audioUrl = "https://blob.test/s.mp3")))

        rule.onNodeWithText("Translate").assertIsDisplayed()
        rule.onNodeWithText("Yo veo un gato.").assertIsDisplayed()
        listOf("I", "see", "a", "cat.").forEach(::tap)
        tap("Check")
        tap("Continue")

        rule.onNodeWithText("What do you hear?").assertIsDisplayed()
        rule.onNodeWithContentDescription("Play pronunciation").assertIsDisplayed()
    }

    @Test
    fun aMultipleChoiceQuestionSendsThePickedOption() {
        play(listOf(multipleChoice("choose"), summaryStep("end")))

        rule.onNodeWithText("Where is the cat?").assertIsDisplayed()
        tap("On the bed")
        tap("Check")

        assertEquals(Json.parseToJsonElement("""{"kind":"multipleChoice","selectedOptionId":"bed"}"""), sent("choose"))
    }

    @Test
    fun aLetterShowsItsFormsAndHowItSounds() {
        play(listOf(alphabet("letter"), summaryStep("end")))

        rule.onNodeWithContentDescription("Alphabet: ñ").assertIsDisplayed()
        rule.onNodeWithText("enye").assertIsDisplayed()
        rule.onNodeWithText("Capital").assertIsDisplayed()
        rule.onNodeWithText("Ñ").assertIsDisplayed()
    }

    @Test
    fun theNextScreenOfTheSameKindStartsEmpty() {
        play(listOf(reading("read-1"), reading("read-2"), summaryStep("end")))

        listOf("Yo", "veo", "un", "gato.").forEach(::tap)
        tap("Check")
        tap("Continue")

        rule.onNodeWithText("Pick words to build your answer").assertIsDisplayed()
    }

    @Test
    fun aLongPressThatNeverMovesKeepsThePlacedWord() {
        play(listOf(reading("read"), summaryStep("end")))

        tap("Yo")
        rule.onNodeWithContentDescription("Position 1: Yo").performTouchInput { longClick() }

        rule.onNodeWithContentDescription("Position 1: Yo").assertIsDisplayed()
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

                override suspend fun gradeSpoken(
                    stepId: String,
                    recording: VoiceRecording,
                ) = GradeOutcome.Failed
            }
        val content = reading("read").content as StepContent.Language
        restoration.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalLessonSpeech provides previewSpeech()) {
                    val language = rememberLessonLanguage("en", "es")
                    LanguageStepView(content, current, result = null, locked = false, language = language, actions = actions)
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
