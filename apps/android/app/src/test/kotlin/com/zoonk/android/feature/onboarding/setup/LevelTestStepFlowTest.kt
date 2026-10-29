package com.zoonk.android.feature.onboarding.setup

import android.app.LocaleManager
import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.onboarding.DONE_NEXT
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.SPEAKING_NEXT
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.listeningQuestion
import com.zoonk.android.feature.onboarding.preparingTestOf
import com.zoonk.android.feature.onboarding.skillLevelOf
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers
import java.io.File

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LevelTestStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeOnboardingApi()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private val store =
        OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
    private var done = 0
    private var progress: Float? = null

    private fun show(
        targetLanguage: String = "it",
        language: String = "en",
        speech: SpeechPlayer? = null,
    ) {
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSetupSpeech provides speech) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        LanguageLevelTestStep(
                            goalId = GOAL_ID,
                            language = language,
                            targetLanguage = targetLanguage,
                            store = store,
                            navigator = rememberAppNavigator(),
                            onProgress = { progress = it },
                            onDone = { done++ },
                        )
                    }
                }
            }
        }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    @Test
    fun openingItOnlyReads() {
        show()

        rule.onNodeWithText("Let's see your level in Italian").assertIsDisplayed()
        rule.onNodeWithText("New to its alphabet?", substring = true).assertDoesNotExist()
        assertEquals(1, api.levelTestReads)
        assertEquals(0, api.prepared)
        assertEquals(emptyList<Any>(), api.levelTestAnswers)
        assertEquals(0, api.finishedLevelTests)
        assertNull(progress)
    }

    @Test
    fun aLanguageInAnotherAlphabetSuggestsSkippingIt() {
        show(targetLanguage = "ja")

        rule.onNodeWithText("Let's see your level in Japanese").assertIsDisplayed()
        rule
            .onNodeWithText(
                "New to its alphabet? Skip the test. Your first session starts with a short lesson on reading it.",
            ).assertIsDisplayed()
    }

    @Test
    fun aLearnerSeeingTheAppInAnotherLanguageCanSwitchToTheirOwn() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        // Robolectric doesn't read the manifest's `android:localeConfig`, which the build generates.
        val config = context.resources.getIdentifier("_generated_res_locale_config", "xml", context.packageName)
        ReflectionHelpers.setField(context.applicationInfo, "localeConfigRes", config)
        show(language = "pt")
        tap("Use the app in português")

        assertEquals("pt", context.getSystemService(LocaleManager::class.java).applicationLocales[0].language)
    }

    @Test
    fun aLearnerSeeingTheAppInTheirOwnLanguageIsNotOfferedIt() {
        show(language = "en-US")

        rule.onNodeWithText("Use the app in", substring = true).assertDoesNotExist()
    }

    @Test
    fun skippingKeepsTheGivenLevelAndMovesOn() {
        show()
        tap("Skip the test")

        assertEquals(1, api.finishedLevelTests)
        assertEquals(1, done)
    }

    @Test
    fun skippingBeforeAnyQuestionsWereWrittenStillMovesOn() {
        api.writeFailure = ApiException(ApiError.Unavailable, "LEVEL_TEST_PREPARING", status = 409)
        show()
        tap("Skip the test")

        assertEquals(1, done)
    }

    @Test
    fun aFinishThatFailedKeepsTheLearnerHere() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Skip the test")

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun theFirstLearnerOfALanguagePairWaitsWhileItsQuestionsAreWritten() {
        api.levelTest = preparingTestOf()
        show()
        tap("Start")

        assertEquals(1, api.prepared)
        rule.onNodeWithText("Preparing your level test").assertIsDisplayed()
        rule.onNodeWithText("The Italian test is new in your language", substring = true).assertIsDisplayed()
        rule.onNodeWithText("Skip the test").assertIsDisplayed()

        api.levelTest = levelTestOf()
        rule.mainClock.advanceTimeBy(POLL_MS)

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        assertEquals(1, api.prepared)
    }

    @Test
    fun aStartThatCouldNotAskForTheQuestionsOffersToTryAgain() {
        api.levelTest = preparingTestOf()
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Start")

        rule.onNodeWithText("Try again").assertIsDisplayed()
        api.writeFailure = null
        tap("Try again")

        assertEquals(2, api.prepared)
    }

    @Test
    fun aRetryAfterALostReplyReadsTheTestInsteadOfSendingTheAnswerAgain() {
        api.levelTestAnswered = { levelTestOf(next = listeningQuestion(), answered = 1) }
        api.replyLost = true
        show()
        tap("Start")
        tap("Every Saturday")
        tap("Confirm")

        api.replyLost = false
        tap("Try again")

        assertEquals(1, api.levelTestAnswers.size)
        rule.onNodeWithText("Marco va al mercato ogni sabato.").assertDoesNotExist()
    }

    @Test
    fun aReadingQuestionSendsThePickedOptionThenAListeningOneFollows() {
        api.levelTestAnswered = { levelTestOf(next = listeningQuestion(), answered = 1) }
        show()
        tap("Start")

        rule.onNodeWithText("Marco va al mercato ogni sabato.").assertIsDisplayed()
        assertEquals(0f, progress)
        rule.onNodeWithText("Confirm").performScrollTo().assertIsNotEnabled()
        tap("Every Saturday")
        tap("Confirm")

        val answer = api.levelTestAnswers.single()
        assertEquals("reading-1" to 0L, answer.questionId to answer.answerIndex)
        rule.onNodeWithText("Where are they meeting?").assertIsDisplayed()
        assertEquals(1f / 12, progress)

        api.levelTestAnswered = { levelTestOf(next = DONE_NEXT, answered = 2) }
        tap("I didn't understand the audio")

        assertEquals("listening-1" to null, api.levelTestAnswers.last().let { it.questionId to it.answerIndex })
        rule.onNodeWithText("Your level today").assertIsDisplayed()
        assertNull(progress)
    }

    @Test
    fun aListeningQuestionAsksForItsMessageInTheLanguageAndShowsItWhenItCannotPlay() {
        val asked = mutableListOf<Pair<String, String>>()
        val speech =
            SpeechPlayer(
                clips = { _, language, text, _ ->
                    asked += language to text
                    throw ApiException(ApiError.Unavailable)
                },
                files = VoiceFiles(folder.root, OkHttpClient(), { false }, session),
                output = SilentOutput,
                sessions = session,
                scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        api.levelTest = levelTestOf(next = listeningQuestion(), answered = 1)
        show(speech = speech)

        rule.onNodeWithText("You got a voice message. Listen and answer.").assertIsDisplayed()
        rule.onNodeWithText(MESSAGE).assertDoesNotExist()
        rule.onNodeWithContentDescription("Play the message").performClick()

        assertEquals(listOf("it" to MESSAGE), asked)
        rule.onNodeWithText("The audio didn't play. Here's what it says:").assertIsDisplayed()
        rule.onNodeWithText(MESSAGE).assertIsDisplayed()
        rule.onNodeWithContentDescription("Play the message again").assertIsDisplayed()
    }

    @Test
    fun anAnswerThatDidNotGoThroughIsSentAgainAsItWas() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Start")
        tap("Every Sunday")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        api.writeFailure = null
        tap("Try again")

        assertEquals(2, api.levelTestAnswers.size)
        assertEquals(api.levelTestAnswers[0], api.levelTestAnswers[1])
        rule.onNodeWithText("Your level today").assertIsDisplayed()
    }

    @Test
    fun theSentenceOutLoudIsGradedThenTheLevelsBuildThePlan() {
        val reading = skillLevelOf("reading", "B1", 2.0)
        api.levelTest = levelTestOf(next = SPEAKING_NEXT, answered = 11, levels = listOf(reading))
        api.spoken = {
            levelTestOf(next = DONE_NEXT, answered = 12, levels = listOf(reading, skillLevelOf("speaking", "A2+", 1.5)))
        }
        show()

        rule.onNodeWithText("Say it out loud").assertIsDisplayed()
        rule.onNodeWithText("Vorrei un caffè, per favore.").assertIsDisplayed()
        rule.onNodeWithText("Record").assertIsDisplayed()

        val outcome = runBlocking { store.speakLevelTest(GOAL_ID, VoiceRecording(ByteArray(8), 1_200)) }

        assertTrue(outcome is GradeOutcome.Graded)
        assertEquals(1, api.spokenTakes.size)
        rule.onNodeWithText("Your level today").assertIsDisplayed()
        rule.onNodeWithText("Speaking").assertIsDisplayed()
        rule.onNodeWithText("A2+").assertIsDisplayed()
        tap("Build my plan")

        assertEquals(1, api.finishedLevelTests)
        assertEquals(1, done)
    }

    @Test
    fun stoppingShowsTheLevelsSoFarAndNoQuestionComesBack() {
        api.levelTest = levelTestOf(answered = 4, levels = listOf(skillLevelOf("reading", "A2", 1.0)))
        show()
        tap("Stop here and see my plan")

        rule.onNodeWithText("Your level today").assertIsDisplayed()
        rule.onNodeWithText("Reading").assertIsDisplayed()
        assertEquals(0, api.finishedLevelTests)
        tap("Build my plan")

        assertEquals(1, api.finishedLevelTests)
        assertEquals(1, done)
    }

    private object SilentOutput : AudioOutput {
        override suspend fun play(
            file: File,
            rate: Float,
            onStart: () -> Unit,
        ) = PlaybackEnd.Ended

        override fun stop() = Unit
    }

    private companion object {
        const val POLL_MS = 3_500L
        const val MESSAGE = "Ci vediamo alla stazione alle otto."
    }
}
