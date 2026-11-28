package com.zoonk.android.feature.player

import android.Manifest
import android.media.AudioManager
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.VoiceAnswerModel
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.feature.pronunciation.FakePronunciationApi
import com.zoonk.android.feature.pronunciation.GOAL_ID
import com.zoonk.android.feature.pronunciation.PronunciationApi
import com.zoonk.android.feature.pronunciation.PronunciationRoundScreen
import com.zoonk.android.feature.pronunciation.PronunciationStore
import com.zoonk.android.feature.pronunciation.PronunciationViewModel
import com.zoonk.android.feature.pronunciation.RECORDING
import com.zoonk.android.feature.pronunciation.reviews
import com.zoonk.android.feature.pronunciation.word
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Generate recording review screenshots on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*RecordNoteScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class RecordNoteScreenshots {
    @get:Rule(order = 0)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 1)
    val tempFolder = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val harness = LessonPlayerHarness(rule) { tempFolder.newFolder() }

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = PHONE)
    fun spokenIdlePhone() = spoken("lesson-spoken-idle-phone")

    @Test
    @Config(qualifiers = WIDE)
    fun spokenIdleWide() = spoken("lesson-spoken-idle-wide")

    @Test
    @Config(qualifiers = MEDIUM)
    fun spokenIdleMedium() = spoken("lesson-spoken-idle-medium")

    @Test
    @Config(qualifiers = PHONE)
    fun spokenRecordingPhone() = spoken("lesson-spoken-recording-phone") { record() }

    @Test
    @Config(qualifiers = WIDE)
    fun spokenRecordingWide() = spoken("lesson-spoken-recording-wide") { record() }

    @Test
    @Config(qualifiers = PHONE)
    fun spokenGettingReadyPhone() = spoken("lesson-spoken-getting-ready-phone") { askForMicrophone() }

    @Test
    @Config(qualifiers = NARROW)
    fun spokenIdleLargeText() {
        RuntimeEnvironment.setFontScale(2f)
        spoken("lesson-spoken-idle-large-text")
    }

    @Test
    @Config(qualifiers = NARROW)
    fun spokenGettingReadyLargeText() {
        RuntimeEnvironment.setFontScale(2f)
        spoken("lesson-spoken-getting-ready-large-text") { askForMicrophone() }
    }

    @Test
    @Config(qualifiers = PHONE)
    fun spokenMissedStartPhone() =
        spoken("lesson-spoken-missed-start-phone", { spokenGrade = { throw ApiException(ApiError.Unavailable, "MISSED_START", 422) } }) {
            takeChecked()
        }

    @Test
    @Config(qualifiers = PHONE)
    fun spokenMicrophoneUnavailablePhone() =
        spoken("lesson-spoken-mic-unavailable-phone") {
            failToOpenMicrophone()
            rule.waitUntilExactlyOneExists(hasText("Your answer"))
        }

    @Test
    @Config(qualifiers = PHONE)
    fun spokenFailedPhone() = spoken("lesson-spoken-failed-phone") { takeChecked() }

    @Test
    @Config(qualifiers = WIDE)
    fun spokenFailedWide() = spoken("lesson-spoken-failed-wide") { takeChecked() }

    @Test
    @Config(qualifiers = PHONE)
    fun spokenNoSpeechPhone() =
        spoken("lesson-spoken-no-speech-phone", { spokenGrade = { throw ApiException(ApiError.Unavailable, "NO_SPEECH", 422) } }) {
            takeChecked()
        }

    @Test
    @Config(qualifiers = PHONE)
    fun typedFailedPhone() = typed("lesson-typed-failed-phone")

    @Test
    @Config(qualifiers = WIDE)
    fun typedFailedWide() = typed("lesson-typed-failed-wide")

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationIdlePhone() = pronunciation("pronunciation-idle-phone")

    @Test
    @Config(qualifiers = WIDE)
    fun pronunciationIdleWide() = pronunciation("pronunciation-idle-wide")

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationRecordingPhone() = pronunciation("pronunciation-recording-phone") { record() }

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationGettingReadyPhone() = pronunciation("pronunciation-getting-ready-phone") { askForMicrophone() }

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationMicrophoneUnavailablePhone() =
        pronunciation("pronunciation-mic-unavailable-phone") {
            failToOpenMicrophone()
            rule.waitUntilExactlyOneExists(hasText("Skip"))
        }

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationNoSpeechPhone() = pronunciation("pronunciation-no-speech-phone", taken = Take.NoSpeech)

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationFailedPhone() = pronunciation("pronunciation-failed-phone", taken = Take.Failed)

    @Test
    @Config(qualifiers = PHONE)
    fun pronunciationSignUpPhone() = pronunciation("pronunciation-sign-up-phone", taken = Take.SignUp)

    @Test
    @Config(qualifiers = WIDE)
    fun pronunciationSignUpWide() = pronunciation("pronunciation-sign-up-wide", taken = Take.SignUp)

    private fun spoken(
        name: String,
        configure: FakeLessonPlayerApi.() -> Unit = {},
        act: () -> Unit = {},
    ) {
        harness.play(listOf(spokenStep("say"), summaryStep("end")), withSpeech = true, configure = configure)
        act()
        shoot(name)
    }

    private fun typed(name: String) {
        harness.play(listOf(typedAnswerStep("why"), summaryStep("end"))) { checkFailures = 1 }
        rule.onNodeWithText("Your answer").performTextInput("Water droplets float")
        rule.onNodeWithText("Check").performClick()
        rule.waitUntil {
            harness.viewModel.state.value
                ?.checkFailed == true
        }
        shoot(name)
    }

    private enum class Take { NoSpeech, Failed, SignUp }

    private fun pronunciation(
        name: String,
        taken: Take? = null,
        act: () -> Unit = {},
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val fake = FakePronunciationApi(reviews(word(1, "hola", respelling = "OH-lah"), word(2, "gracias")), null)
        val api =
            object : PronunciationApi by fake {
                override suspend fun answer(
                    session: AuthenticatedSession,
                    reviewId: String,
                    goalId: String,
                    roundId: String,
                    recording: VoiceRecording,
                    timeZone: String,
                ) = when (taken) {
                    Take.Failed -> throw ApiException(ApiError.Network)
                    Take.SignUp -> throw ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", 403)
                    else -> fake.answer(session, reviewId, goalId, roundId, recording, timeZone)
                }
            }
        val store = PronunciationStore(api, cache) { "UTC" }
        val model = PronunciationViewModel(rule.activity).apply { start(GOAL_ID, fake.words, store) }
        if (taken != null) runBlocking { model.round!!.record(model.round!!.attempt, RECORDING) }
        val app = AppContainer.preview(rule.activity)
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    PronunciationRoundScreen(
                        model.round!!,
                        model,
                        previewSpeech(),
                        rememberAppNavigator(),
                        buddy = null,
                        ceremony = { milestone, onClose -> SessionCeremony(app, milestone, onClose) },
                    )
                }
            }
        }
        rule.waitForIdle()
        act()
        shoot(name)
    }

    private fun record() {
        shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        rule.onNodeWithText("Record").performClick()
        rule.waitUntilExactlyOneExists(hasText("Stop"))
    }

    private fun failToOpenMicrophone() {
        shadowOf(rule.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        val audio = rule.activity.application.getSystemService(AudioManager::class.java)
        shadowOf(audio).setNextFocusRequestResponse(AudioManager.AUDIOFOCUS_REQUEST_FAILED)
        rule.onNodeWithText("Record").performClick()
    }

    private fun askForMicrophone() {
        shadowOf(rule.activity.application).denyPermissions(Manifest.permission.RECORD_AUDIO)
        rule.onNodeWithText("Record").performClick()
    }

    private fun takeChecked() {
        checkTake("spoken:say")
        rule.waitUntil(5_000) {
            harness.viewModel.state.value
                ?.checkFailed == true
        }
    }

    /** Robolectric's recorder records nothing, so the take the learner made is handed to its grading as Stop would. */
    private fun checkTake(key: String) {
        val model = ViewModelProvider(rule.activity)[key, VoiceAnswerModel::class.java]
        val check =
            VoiceAnswerModel::class.java.declaredMethods.first { method ->
                method.parameterTypes.contentEquals(arrayOf(VoiceRecording::class.java))
            }
        rule.runOnUiThread { check.invoke(model, VoiceRecording(ByteArray(64) { 1 }, 1_200)) }
    }

    private fun shoot(name: String) {
        rule.waitForIdle()
        writeRender(File(folder, "$name.png"), rule.onRoot().captureRender().asAndroidBitmap())
    }

    private companion object {
        const val NARROW = "w320dp-h760dp-xxhdpi"
        const val PHONE = "w411dp-h891dp-xxhdpi"
        const val MEDIUM = "w700dp-h1000dp-xhdpi"
        const val WIDE = "w1280dp-h800dp-land-xhdpi"
    }
}
