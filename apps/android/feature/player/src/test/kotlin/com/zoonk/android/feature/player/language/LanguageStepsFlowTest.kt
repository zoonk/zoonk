package com.zoonk.android.feature.player.language

import androidx.activity.ComponentActivity
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
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
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.SpeechPlayer
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
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** A learner answering each language screen, through the real player and what it sends to check. */
@RunWith(AndroidJUnit4::class)
class LanguageStepsFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
    private lateinit var api: FakeLessonPlayerApi
    private lateinit var speech: SpeechPlayer
    private lateinit var colors: ColorScheme

    private val exits =
        object : LessonPlayerExits {
            override fun close() = Unit

            override fun open(route: AppRoute) = Unit

            override fun replace(route: AppRoute) = Unit
        }

    private fun play(
        steps: List<LessonStep>,
        learner: String = "en",
        target: String? = "es",
    ) {
        val lesson = playable(steps).copy(language = learner, targetLanguage = target)
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
                colors = MaterialTheme.colorScheme
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalLessonSpeech provides previewSpeech().also { speech = it },
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

    private fun bounds(description: String) = rule.onNodeWithContentDescription(description).getUnclippedBoundsInRoot()

    @Test
    @Config(qualifiers = "w360dp-h800dp")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aPhonesWordBankStaysAboveTheActionsWhileTheSentenceGrows() {
        play(listOf(longReading("read"), summaryStep("end")), learner = "pt", target = "en")
        val bank = bounds("Word bank")
        val emptyAnswer = bounds("Your answer")

        LONG_SENTENCE.forEach { word ->
            tap(word)
            assertEquals(bank, bounds("Word bank"))
        }

        assertTrue(bounds("Your answer").height > emptyAnswer.height * 2)
        assertTrue(rule.onNodeWithText("Check").getUnclippedBoundsInRoot().top - bank.bottom < 48.dp)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aWideWindowKeepsTheWordBankUnderTheAnswer() {
        play(listOf(longReading("read"), summaryStep("end")), learner = "pt", target = "en")

        assertTrue(bounds("Word bank").top - bounds("Your answer").bottom < 48.dp)
    }

    @Test
    @Config(qualifiers = "w360dp-h480dp")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun aWordBankThatNoLongerFitsFollowsTheAnswerAndScrolls() {
        play(listOf(longReading("read"), summaryStep("end")), learner = "pt", target = "en")
        LONG_SENTENCE.forEach(::tap)

        val gap = bounds("Word bank").top - bounds("Your answer").bottom
        assertTrue(gap >= 0.dp && gap < 48.dp)
        rule.onNodeWithText("those").performScrollTo().assertIsDisplayed()
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

    /** The color [text] is drawn in, where it first shows: a placed word before its tile in the bank. */
    private fun color(text: String): Color {
        val layouts = mutableListOf<TextLayoutResult>()
        rule
            .onAllNodesWithText(text, useUnmergedTree = true)
            .onFirst()
            .fetchSemanticsNode()
            .config[SemanticsActions.GetTextLayoutResult]
            .action
            ?.invoke(layouts)
        return layouts
            .single()
            .layoutInput.style.color
    }

    @Test
    fun aCheckedBlanksQuestionAndSentenceStepBackWhileThePlacedWordStays() {
        play(listOf(fillBlank("blank"), summaryStep("end")))
        tap("pay")

        assertEquals(colors.onSurface, color("Fill in the blank"))
        assertEquals(colors.onSurface, color("rent."))

        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()

        assertEquals(colors.onSurfaceVariant, color("Fill in the blank"))
        assertEquals(colors.onSurfaceVariant, color("rent."))
        assertNotEquals(colors.onSurfaceVariant, color("pay"))
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
    fun aReadingsSentenceIsReadOnceAsItsHeading() {
        val catOnly = promptWords("I" to null, "see" to null, "a" to null, "cat." to "gato")
        play(listOf(step("read", StepKind.Reading, "reading", sentence = sentence(null), promptWords = catOnly), summaryStep("end")))

        val prompt = rule.onNode(isHeading() and hasContentDescription("I see a cat.")).fetchSemanticsNode()
        assertEquals(null, prompt.config.getOrNull(SemanticsProperties.Text))
    }

    @Test
    fun aQuestionsPictureWithNoAddressShowsWhatItShows() {
        play(listOf(multipleChoice("ask", image = """{"prompt":"A cat asleep on a bed"}"""), summaryStep("end")))

        rule.onNodeWithText("A cat asleep on a bed").assertIsDisplayed()
    }

    @Test
    fun aTranslationInALessonWithNoLanguageOfItsOwnAsksToTranslate() {
        play(listOf(translation("pick"), summaryStep("end")), target = null)

        rule.onNodeWithText("Translate").assertIsDisplayed()
    }

    @Test
    fun aTranslationPickTappedAgainStaysPicked() {
        play(listOf(translation("pick"), summaryStep("end")))

        tap("gato")
        tap("gato")
        tap("Check")

        assertEquals(Json.parseToJsonElement("""{"kind":"translation","selectedOptionId":"w-1"}"""), sent("pick"))
    }

    @Test
    fun aTranslationPickedByItsNumberKeySaysItsWordAsATapDoes() {
        play(listOf(translation("pick", gatoAudio = "https://blob.zoonk.test/gato.mp3"), summaryStep("end")))

        rule.onRoot().performKeyInput { pressKey(Key.Two) }

        assertNotNull(speech.playback.value)
    }

    @Test
    fun aTranslationPickedTwiceByItsNumberKeyStaysPicked() {
        play(listOf(translation("pick"), summaryStep("end")))

        rule.onRoot().performKeyInput { pressKey(Key.Two) }
        rule.onRoot().performKeyInput { pressKey(Key.Two) }
        tap("Check")

        assertEquals(Json.parseToJsonElement("""{"kind":"translation","selectedOptionId":"w-1"}"""), sent("pick"))
    }

    @Test
    fun aTranslationsWordHintsShowInItsFeedback() {
        play(listOf(translation("pick", hints = """{"note":"You say it to a cat.","pronunciationTip":null}"""), summaryStep("end")))

        rule.onNodeWithText("You say it to a cat.").assertDoesNotExist()
        tap("gato")
        tap("Check")

        rule.onNodeWithText("You say it to a cat.").performScrollTo().assertIsDisplayed()
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

    private fun tile(word: String) = rule.onNode(hasText(word) and hasAnyAncestor(hasContentDescription("Word bank")))

    @OptIn(ExperimentalTestApi::class)
    private fun SemanticsNodeInteraction.pressEnter() {
        requestFocus()
        rule.onRoot().performKeyInput { pressKey(Key.Enter) }
    }

    @Test
    fun aKeyboardPlacingWordsMovesToTheNextTileThenToCheck() {
        play(listOf(reading("read"), summaryStep("end")))

        tile("Yo").pressEnter()
        tile("gato.").assertIsFocused()
        tile("gato.").pressEnter()
        tile("veo").assertIsFocused()
        tile("veo").pressEnter()
        tile("un").assertIsFocused()
        tile("un").pressEnter()

        rule.onNodeWithText("Check").assertIsFocused()
    }

    @Test
    fun aKeyboardTakingWordsOutMovesToTheNextWordThenToTheTileThatCameBack() {
        play(listOf(reading("read"), summaryStep("end")))
        listOf("Yo", "veo").forEach(::tap)

        rule.onNodeWithContentDescription("Position 2: veo").pressEnter()
        rule.onNodeWithContentDescription("Position 1: Yo").assertIsFocused()
        rule.onNodeWithContentDescription("Position 1: Yo").pressEnter()

        tile("Yo").assertIsFocused()
    }

    @Test
    fun aKeyboardFillingTheLastBlankMovesToCheckAndClearingItToTheTileThatCameBack() {
        play(listOf(fillBlank("blank"), summaryStep("end")))

        tile("pay").pressEnter()
        rule.onNodeWithText("Check").assertIsFocused()
        rule.onNodeWithContentDescription("Blank 1: pay").pressEnter()

        tile("pay").assertIsFocused()
    }

    @Test
    fun aTapLeavesFocusWhereItWas() {
        play(listOf(reading("read"), summaryStep("end")))

        listOf("Yo", "veo", "un", "gato.").forEach { tile(it).performTouchInput { click() } }

        rule.onNodeWithText("Check").assertIsNotFocused()
    }
}
