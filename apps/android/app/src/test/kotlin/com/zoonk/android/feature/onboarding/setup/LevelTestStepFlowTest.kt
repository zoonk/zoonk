package com.zoonk.android.feature.onboarding.setup

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
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.listeningQuestion
import com.zoonk.android.feature.onboarding.preparingTestOf
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
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
        OnboardingStore(
            api,
            AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
            session,
        ) { SignInResult.SignedIn }
    private var done = 0
    private var progress: Float? = null

    private fun show(speech: SpeechPlayer? = null) {
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSetupSpeech provides speech) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        LanguageLevelTestStep(
                            goalId = GOAL_ID,
                            language = "en",
                            targetLanguage = "it",
                            testMinutes = 3,
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
    fun startReadsTheTestFirstSoQuestionsWrittenMeanwhileOpenWithoutTheWait() {
        api.levelTest = preparingTestOf()
        show()
        api.levelTest = levelTestOf()
        val read = CompletableDeferred<Unit>()
        api.levelTestGate = read
        tap("Start")

        rule.onNodeWithText("Preparing your level test").assertDoesNotExist()
        rule.onNodeWithText("Let's see your level in Italian").assertIsDisplayed()
        rule.onNodeWithText("Start").assertIsNotEnabled()

        read.complete(Unit)

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        assertEquals(0, api.prepared)
    }

    @Test
    fun aStartWhoseReadFailedSaysItDidNotStartAndTriesAgain() {
        api.levelTest = preparingTestOf()
        show()
        api.levelTestGate = CompletableDeferred<Unit>().apply { completeExceptionally(ApiException(ApiError.Network)) }
        tap("Start")

        rule.onNodeWithText("This didn't start").assertIsDisplayed()
        assertEquals(0, api.prepared)

        api.levelTestGate = null
        tap("Try again")

        assertEquals(1, api.prepared)
        rule.onNodeWithText("Preparing your level test").assertIsDisplayed()
    }

    @Test
    fun aStartWhoseReadFailedSaysItDidNotStartEvenOverQuestionsReadBefore() {
        show()
        api.levelTestGate = CompletableDeferred<Unit>().apply { completeExceptionally(ApiException(ApiError.Network)) }
        tap("Start")

        rule.onNodeWithText("This didn't start").assertIsDisplayed()
        rule.onNodeWithText("When does Marco go to the market?").assertDoesNotExist()

        api.levelTestGate = null
        tap("Try again")

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
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

    private val asked = mutableListOf<Pair<String, String>>()
    private val downloads = mutableListOf<String>()

    private fun speech(): SpeechPlayer {
        val http =
            OkHttpClient
                .Builder()
                .addInterceptor { chain ->
                    downloads += chain.request().url.toString()
                    Response
                        .Builder()
                        .request(chain.request())
                        .protocol(Protocol.HTTP_1_1)
                        .code(200)
                        .message("")
                        .body("mp3".toResponseBody())
                        .build()
                }.build()
        return SpeechPlayer(
            clips = { _, language, text, _ ->
                asked += language to text
                throw ApiException(ApiError.Unavailable)
            },
            files = VoiceFiles(folder.root, http, { false }, session, Dispatchers.Main.immediate),
            output = SilentOutput,
            sessions = session,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    }

    @Test
    fun aStoredRecordingPlaysWithoutAskingForAClip() {
        api.levelTest = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 1)
        show(speech = speech())
        rule.onNodeWithContentDescription("Play the message").performClick()

        assertEquals(listOf(CLIP_URL), downloads)
        assertEquals(emptyList<Pair<String, String>>(), asked)
        rule.onNodeWithContentDescription("Play the message again").assertIsDisplayed()
    }

    @Test
    fun aListeningMessageOnItsWayShowsUntilARereadBringsIt() {
        api.levelTest = levelTestOf(next = listeningQuestion(audioPending = true), answered = 1)
        show(speech = speech())

        rule.onNodeWithText("The voice message is on its way…").assertIsDisplayed()
        rule.onNodeWithContentDescription("Play the message").assertDoesNotExist()
        rule.onNodeWithText("Skip this question").assertIsDisplayed()
        val reads = api.levelTestReads

        api.levelTest = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 1)
        rule.mainClock.advanceTimeBy(POLL_MS)

        assertEquals(reads + 1, api.levelTestReads)
        rule.onNodeWithText("The voice message is on its way…").assertDoesNotExist()
        rule.onNodeWithContentDescription("Play the message").assertIsDisplayed()
        rule.onNodeWithText("I didn't understand the audio").assertIsDisplayed()
    }

    @Test
    fun skippingAListeningQuestionWhoseMessageIsOnItsWayDoesNotScoreIt() {
        api.levelTest = levelTestOf(next = listeningQuestion(audioPending = true), answered = 1)
        show(speech = speech())
        tap("Skip this question")

        assertEquals(
            listOf(Triple("listening-1", null, true)),
            api.levelTestAnswers.map { Triple(it.questionId, it.answerIndex, it.skipped) },
        )
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
        const val CLIP_URL = "https://clips.test/level-test/stazione.mp3"
    }
}
