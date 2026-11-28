package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.isDisplayed
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
import com.zoonk.android.feature.onboarding.DONE_NEXT
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.listeningQuestion
import com.zoonk.android.feature.onboarding.preparingTestOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
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

    private val api =
        FakeOnboardingApi().apply {
            setup = { setupView(steps = listOf("placement", "plan"), kind = "language", targetLanguage = "it", placement = OFFER) }
            levelTest = levelTestOf()
        }
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    private val store =
        OnboardingStore(
            api,
            cache,
            session,
        ) { SignInResult.SignedIn }

    /** The language goal's setup at its level test, whose Start opens [opened]. */
    private fun show(
        opened: LanguageLevelTest = levelTestOf(attemptId = ATTEMPT),
        speech: SpeechPlayer? = null,
    ) {
        api.startedLevelTest = { opened }
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSetupSpeech provides speech) {
                    GoalSetupScreen(
                        AppRoute.GoalSetup(GOAL_ID),
                        store,
                        PlanStore(FakePlanApi(), cache),
                        false,
                        rememberAppNavigator(),
                    )
                }
            }
        }
    }

    private fun tap(text: String) {
        val node = rule.onNodeWithText(text)
        if (!node.isDisplayed()) node.performScrollTo()
        node.performClick()
    }

    private val placementAnswers get() = api.answers.count { (_, input) -> input is OnboardingAnswerInputOneOf10Value }

    @Test
    fun openingItOnlyReads() {
        show()

        rule.onNodeWithText("Where would you like to start?").assertIsDisplayed()
        rule.onNodeWithText("Level test").assertIsDisplayed()
        rule.onNodeWithText("Up to 12 questions").assertIsDisplayed()
        assertEquals(1, api.levelTestReads)
        assertEquals(0, api.levelTestStarts)
        assertEquals(0, api.prepared)
        assertEquals(emptyList<Any>(), api.levelTestAnswers)
        assertEquals(0, api.finishedLevelTests)
    }

    @Test
    fun startOpensTheTestAtItsFirstReadingQuestionOfTwelve() {
        show()
        tap("Start")

        assertEquals(1, api.levelTestStarts)
        rule.onNodeWithContentDescription("Question 1 of 12").assertIsDisplayed()
        rule.onNodeWithText("Reading").assertIsDisplayed()
        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        tap("Every Saturday")
        tap("Confirm")

        assertEquals(listOf(ATTEMPT), api.levelTestAnswers.map { it.attemptId?.toString() })
        rule.onNodeWithText("Your Italian level").assertIsDisplayed()
        assertEquals(1, api.finishedLevelTests)
        assertEquals(0, placementAnswers)

        tap("Continue")

        assertEquals(1, placementAnswers)
    }

    @Test
    fun aLearnerWhoAskedForTheTestStartsItWithoutTheOffer() {
        api.setup = { setupView(steps = listOf("placement", "plan"), kind = "language", targetLanguage = "it", placement = DIRECT) }
        show()

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        rule.onNodeWithText("Where would you like to start?").assertDoesNotExist()
        assertEquals(1, api.levelTestStarts)
    }

    @Test
    fun firstLessonGoesOnWithoutATest() {
        show()
        tap("First lesson")
        tap("Continue")

        rule.runOnIdle { assertEquals(1, placementAnswers) }
        assertEquals(0, api.levelTestStarts)
        assertEquals(0, api.finishedLevelTests)
    }

    @Test
    fun cantListenNowEndsTheListeningUnscoredAndSaysListeningWasNotTested() {
        api.levelTestResult = READING_ONLY
        api.levelTestAnswered = { levelTestOf(next = DONE_NEXT, answered = 5, attemptId = ATTEMPT) }
        show(opened = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 4, attemptId = ATTEMPT), speech = speech())
        tap("Start")
        rule.onNodeWithText("Listening").assertIsDisplayed()
        rule.onNodeWithContentDescription("Question 5 of 12").assertIsDisplayed()
        tap("Can't listen now")

        assertEquals(listOf(true), api.levelTestAnswers.map { it.audioDeferred })
        assertEquals(listOf<Long?>(null), api.levelTestAnswers.map { it.answerIndex })
        rule.onNodeWithText("You can take the test again later, from your plan.").assertIsDisplayed()
        rule.onNodeWithText("Not tested yet").assertIsDisplayed()
    }

    @Test
    fun theFirstLearnerOfALanguagePairWaitsWhileItsQuestionsAreWritten() {
        api.levelTest = preparingTestOf()
        show(opened = preparingTestOf(attemptId = ATTEMPT))
        tap("Start")

        rule.onNodeWithText("Getting your test ready").assertIsDisplayed()
        rule.onNodeWithText("This takes a minute or two.").assertIsDisplayed()
        rule.onNodeWithText("You can take the test later, from your plan.").assertIsDisplayed()

        api.levelTest = levelTestOf(attemptId = ATTEMPT)
        rule.mainClock.advanceTimeBy(POLL_MS)

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        assertEquals(0, api.prepared)
    }

    @Test
    fun skippingTheWaitMovesOnWithTheSetup() {
        api.levelTest = preparingTestOf()
        show(opened = preparingTestOf(attemptId = ATTEMPT))
        tap("Start")
        tap("Skip")

        assertEquals(1, placementAnswers)
    }

    @Test
    fun aRunThatStoppedWritingTheQuestionsOffersToTryAgain() {
        api.levelTest = preparingTestOf(startedAt = "2026-10-29T10:00:03Z")
        show(opened = preparingTestOf(startedAt = "2026-10-29T10:00:03Z", attemptId = ATTEMPT))
        tap("Start")
        rule.mainClock.advanceTimeBy(POLL_MS)
        api.levelTest = preparingTestOf()
        rule.mainClock.advanceTimeBy(POLL_MS)

        tap("Try again")

        assertEquals(1, api.prepared)
    }

    @Test
    fun aStartThatFailedSaysSoAndStays() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Start")

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        rule.onNodeWithText("Where would you like to start?").assertIsDisplayed()
    }

    @Test
    fun aRetryAfterALostReplyReadsTheTestInsteadOfSendingTheAnswerAgain() {
        api.levelTestAnswered = { levelTestOf(next = listeningQuestion(), answered = 1, attemptId = ATTEMPT) }
        show()
        tap("Start")
        api.replyLost = true
        tap("Every Saturday")
        tap("Confirm")

        api.replyLost = false
        tap("Confirm")

        assertEquals(1, api.levelTestAnswers.size)
        rule.onNodeWithText("Marco va al mercato ogni sabato.").assertDoesNotExist()
    }

    private val asked = mutableListOf<Pair<String, String>>()
    private val downloads = mutableListOf<String>()

    @Test
    fun aPressThatEndsAListeningQuestionSilencesItsMessageBeforeItsSaveIsBack() {
        val gate = CompletableDeferred<Unit>()
        api.levelTestWriteGate = gate
        show(
            opened = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 1, attemptId = ATTEMPT),
            speech = speech(HeldOutput()),
        )
        tap("Start")
        rule.onNodeWithContentDescription("Play the message").performClick()
        rule.onNodeWithContentDescription("Stop the audio").assertIsDisplayed()

        tap("Can't listen now")

        rule.onNodeWithContentDescription("Stop the audio").assertDoesNotExist()
        rule.onNodeWithContentDescription("Play the message again").assertIsDisplayed()
        assertEquals(1, api.levelTestAnswers.size)
        gate.complete(Unit)
    }

    @Test
    fun stoppingTheTestSilencesAPlayingMessageAtThePress() {
        val gate = CompletableDeferred<Unit>()
        show(
            opened = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 4, attemptId = ATTEMPT, canStop = true),
            speech = speech(HeldOutput()),
        )
        tap("Start")
        rule.onNodeWithContentDescription("Play the message").performClick()
        rule.onNodeWithContentDescription("Stop the audio").assertIsDisplayed()

        api.levelTestWriteGate = gate
        rule.onNodeWithContentDescription("Leave").performClick()
        tap("Stop and use my answers")

        rule.onNodeWithContentDescription("Stop the audio").assertDoesNotExist()
        assertEquals(0, api.finishedLevelTests)
        gate.complete(Unit)
    }

    @Test
    fun aMessageThatDidNotPlayIsTriedAgainFromItsOwnButton() {
        show(opened = levelTestOf(next = listeningQuestion(), answered = 1, attemptId = ATTEMPT), speech = speech())
        tap("Start")
        rule.onNodeWithContentDescription("Play the message").performClick()

        rule.onNodeWithText("The audio didn't play.").assertIsDisplayed()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        rule.onNodeWithText("Skip this question").assertIsDisplayed()
        rule.onNodeWithContentDescription("Try the audio again").performClick()

        assertEquals(2, asked.size)
    }

    @Test
    fun aMessageShowsTheSameLengthBeforeDuringAndAfterAPlay() {
        show(
            opened = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL, durationMs = 8_500), answered = 1, attemptId = ATTEMPT),
            speech = speech(HeldOutput()),
        )
        tap("Start")
        rule.onNodeWithText("0:09").assertIsDisplayed()

        rule.onNodeWithContentDescription("Play the message").performClick()
        rule.mainClock.advanceTimeBy(3_000)

        rule.onNodeWithText("0:09").assertIsDisplayed()
        rule.onNodeWithContentDescription("Stop the audio").performClick()
        rule.onNodeWithText("0:09").assertIsDisplayed()
    }

    private fun speech(output: AudioOutput = SilentOutput): SpeechPlayer {
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
            output = output,
            sessions = session,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    }

    @Test
    fun aStoredRecordingPlaysWithoutAskingForAClipAndOncePlayedTheWayAroundItBecomesTheMiss() {
        show(opened = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 1, attemptId = ATTEMPT), speech = speech())
        tap("Start")
        rule.onNodeWithText("Can't listen now").assertIsDisplayed()
        rule.onNodeWithContentDescription("Play the message").performClick()

        assertEquals(listOf(CLIP_URL), downloads)
        assertEquals(emptyList<Pair<String, String>>(), asked)
        rule.onNodeWithContentDescription("Play the message again").assertIsDisplayed()
        rule.onNodeWithText("Can't listen now").assertDoesNotExist()
        tap("I didn't understand")

        assertEquals(
            listOf(Triple("listening-1", null, null)),
            api.levelTestAnswers.map { Triple(it.questionId, it.answerIndex, it.audioDeferred) },
        )
    }

    @Test
    fun aTestLeftOpenGoesOnAndItsListeningMessageShowsOnceARereadBringsIt() {
        api.levelTest = levelTestOf(next = listeningQuestion(audioPending = true), answered = 1, attemptId = ATTEMPT)
        show(speech = speech())

        rule.onNodeWithText("The voice message is on its way…").assertIsDisplayed()
        rule.onNodeWithContentDescription("Play the message").assertIsNotEnabled()
        rule.onNodeWithText("Skip this question").assertIsDisplayed()
        val reads = api.levelTestReads

        api.levelTest = levelTestOf(next = listeningQuestion(audioUrl = CLIP_URL), answered = 1, attemptId = ATTEMPT)
        rule.mainClock.advanceTimeBy(POLL_MS)

        assertEquals(reads + 1, api.levelTestReads)
        rule.onNodeWithText("The voice message is on its way…").assertDoesNotExist()
        rule.onNodeWithContentDescription("Play the message").assertIsEnabled()
        rule.onNodeWithText("Can't listen now").assertIsDisplayed()
    }

    @Test
    fun aRecordingStillOnItsWayAfterTheReadsGiveUpIsStillSkippedOneQuestionAtATime() {
        api.levelTest = levelTestOf(next = listeningQuestion(audioPending = true), answered = 1, attemptId = ATTEMPT)
        show(speech = speech())
        rule.onNodeWithText("Skip this question").assertIsDisplayed()

        api.levelTestGate = CompletableDeferred<Unit>().apply { completeExceptionally(ApiException(ApiError.Network)) }
        repeat(4) { rule.mainClock.advanceTimeBy(POLL_MS) }

        rule.onNodeWithText("Skip this question").assertIsDisplayed()
        rule.onNodeWithText("Can't listen now").assertDoesNotExist()
        rule.onNodeWithContentDescription("Play the message").assertIsEnabled()
    }

    @Test
    fun skippingAListeningQuestionWhoseMessageIsOnItsWayDoesNotScoreIt() {
        show(opened = levelTestOf(next = listeningQuestion(audioPending = true), answered = 1, attemptId = ATTEMPT), speech = speech())
        tap("Start")
        tap("Skip this question")

        assertEquals(
            listOf(Triple("listening-1", null, true)),
            api.levelTestAnswers.map { Triple(it.questionId, it.answerIndex, it.skipped) },
        )
    }

    @Test
    fun anAnswerThatDidNotGoThroughIsSentAgainAsItWas() {
        show()
        tap("Start")
        api.writeFailure = ApiException(ApiError.Network)
        tap("Every Sunday")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        api.writeFailure = null
        tap("Confirm")

        assertEquals(2, api.levelTestAnswers.size)
        assertEquals(api.levelTestAnswers[0], api.levelTestAnswers[1])
        rule.onNodeWithText("Your Italian level").assertIsDisplayed()
    }

    @Test
    fun stoppingThatFailedSaysSoOnTheQuestionThenShowsTheRanges() {
        api.levelTestAnswered = { levelTestOf(next = listeningQuestion(), answered = 4, attemptId = ATTEMPT, canStop = true) }
        show()
        tap("Start")
        tap("Every Saturday")
        tap("Confirm")

        api.writeFailure = ApiException(ApiError.Network)
        rule.onNodeWithContentDescription("Leave").performClick()
        tap("Stop and use my answers")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
        api.writeFailure = null
        rule.onNodeWithContentDescription("Leave").performClick()
        tap("Stop and use my answers")

        rule.onNodeWithText("Your Italian level").assertIsDisplayed()
    }

    /** A message that plays until something stops it. */
    private class HeldOutput : AudioOutput {
        private var playing: CompletableDeferred<Unit>? = null

        override suspend fun play(
            file: File,
            rate: Float,
            onStart: () -> Unit,
        ): PlaybackEnd {
            val play = CompletableDeferred<Unit>().also { playing = it }
            onStart()
            play.await()
            return PlaybackEnd.Stopped
        }

        override fun stop() {
            playing?.complete(Unit)
        }
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
        const val ATTEMPT = "6f1c2e2a-6d1b-4c8e-9a51-2f4b8f0c7a11"
        const val OFFER = """{"mode":"offer","test":{"kind":"language"}}"""
        const val DIRECT = """{"mode":"direct","test":{"kind":"language"}}"""
        val READING_ONLY: LanguageLevelTestResult =
            ApiJson.decodeFromString(
                """
                {"levels":[],"result":{"attemptId":"$ATTEMPT","changeId":null,"end":"audio_deferred","finishedAt":"2026-11-26T10:00:00Z",
                 "lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"B1","high":"B2"}}}}
                """.trimIndent(),
            )
        const val POLL_MS = 3_500L
        const val CLIP_URL = "https://clips.test/level-test/stazione.mp3"
    }
}
