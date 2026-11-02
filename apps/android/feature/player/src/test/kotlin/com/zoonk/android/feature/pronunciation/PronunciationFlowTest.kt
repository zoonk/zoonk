package com.zoonk.android.feature.pronunciation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
    fun aFailedReadNeverStartsTheRoundFromTheCachedWords() {
        val api = FakePronunciationApi(reviews(word(1, "hola")))
        val store = store(api)
        runBlocking { store.reviews(GOAL_ID).refresh() }
        api.words = reviews(word(2, "gracias"))
        api.reviewsFail = true

        open(api, store)

        rule.onNodeWithText("This page didn't load").assertIsDisplayed()
        rule.onNodeWithText("hola").assertDoesNotExist()

        api.reviewsFail = false
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("gracias").assertIsDisplayed()
    }
}
