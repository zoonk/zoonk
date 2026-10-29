package com.zoonk.android.feature.pronunciation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PronunciationFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun store(api: FakePronunciationApi) =
        PronunciationStore(
            api,
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            ),
        ) { "America/Sao_Paulo" }

    private fun open(
        api: FakePronunciationApi,
        store: PronunciationStore = store(api),
    ) {
        rule.setContent {
            ZoonkTheme { PronunciationTask(GOAL_ID, "local", store, previewSpeech(), rememberAppNavigator()) }
        }
    }

    private fun play(api: FakePronunciationApi): PronunciationRound {
        val model = PronunciationViewModel(rule.activity, SavedStateHandle()).apply { start(GOAL_ID, api.words, store(api)) }
        rule.setContent {
            ZoonkTheme { PronunciationRoundScreen(model.round!!, model, previewSpeech(), rememberAppNavigator()) }
        }
        return model.round!!
    }

    private fun PronunciationRound.say() {
        rule.runOnIdle { runBlocking { record(index, RECORDING) } }
    }

    @Test
    fun aWordShowsHowToSayItAndSkippingEveryWordSaysNothingWasSaid() {
        val api = FakePronunciationApi(reviews(word(1, "hola", respelling = "OH-lah", tip = "The h is silent."), word(2, "gracias")))
        open(api)

        rule.onNodeWithText("Word 1 of 2").assertIsDisplayed()
        rule.onNodeWithText("hola").assertIsDisplayed()
        rule.onNodeWithText("Say it like OH-lah").assertIsDisplayed()
        rule.onNodeWithText("Listen").assertIsDisplayed()
        rule.onNodeWithText("Listen slowly").assertIsDisplayed()
        rule.onNodeWithText("The h is silent.").assertIsDisplayed()
        rule.onNodeWithText("Press Record and say the word out loud").assertIsDisplayed()

        rule.onNodeWithContentDescription("Screen options").performClick()
        rule.onNodeWithText("Skip this word").performClick()
        rule.onNodeWithText("Word 2 of 2").assertIsDisplayed()
        rule.onNodeWithText("gracias").assertIsDisplayed()

        rule.onNodeWithContentDescription("Screen options").performClick()
        rule.onNodeWithText("Skip this word").performClick()

        rule.onNodeWithText("Nothing said this time").assertIsDisplayed()
        rule.onNodeWithText("Done").assertIsDisplayed()
        assertTrue(api.finished.isEmpty())
    }

    @Test
    fun noWordsDueSaysSo() {
        open(FakePronunciationApi(reviews()))

        rule.onNodeWithText("No words to say again today.").assertIsDisplayed()
        rule.onNodeWithText("Done").assertIsDisplayed()
    }

    @Test
    fun aWordThatSoundedDifferentIsSaidAgainUntilItSoundsRightThenTheRoundCounts() {
        val api = FakePronunciationApi(reviews(word(1, "hola")), grade(isCorrect = false, transcript = "ola"), grade(isCorrect = true))
        val round = play(api)

        round.say()
        rule.onNodeWithText("We heard “ola”").assertIsDisplayed()
        rule.onNodeWithText("You've got this one. It won't come back.").assertIsDisplayed()
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("Press Record and say the word out loud").assertIsDisplayed()

        round.say()
        rule.onNodeWithText("That sounded right").assertIsDisplayed()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        rule.onNodeWithText("See how it went").performClick()

        rule.onNodeWithText("Practice done").assertIsDisplayed()
        rule.onNodeWithText("1 of 1 sounded right").assertIsDisplayed()
        assertEquals(listOf(round.roundId), api.finished)
    }

    @Test
    fun aRecordingWithoutTheWordAsksToSayItCloser() {
        val round = play(FakePronunciationApi(reviews(word(1, "hola")), null))

        round.say()

        rule.onNodeWithText("We couldn't hear the word. Try again a little closer.").assertIsDisplayed()
        rule.onNodeWithText("Record").assertIsDisplayed()
    }

    @Test
    fun reopeningAfterARoundShowsTheWordsDueNowNotTheCachedOnes() {
        val api = FakePronunciationApi(reviews(word(1, "hola")))
        val store = store(api)
        runBlocking { store.reviews(GOAL_ID).refresh() }
        api.words = reviews(word(2, "gracias"))

        open(api, store)

        rule.onNodeWithText("gracias").assertIsDisplayed()
        rule.onNodeWithText("hola").assertDoesNotExist()
    }

    @Test
    fun aRoundRestoredAfterTheAppClosedCountsTheWordsAlreadySaid() {
        val api = FakePronunciationApi(reviews())
        val saved = SavedStateHandle(mapOf("roundId" to "round-before", "answered" to true))
        val model = PronunciationViewModel(rule.activity, saved)

        rule.runOnIdle { model.start(GOAL_ID, api.words, store(api)) }
        rule.setContent { ZoonkTheme { PronunciationRoundScreen(model.round!!, model, previewSpeech(), rememberAppNavigator()) } }

        rule.onNodeWithText("Practice done").assertIsDisplayed()
        assertEquals(listOf("round-before"), api.finished)
    }
}
