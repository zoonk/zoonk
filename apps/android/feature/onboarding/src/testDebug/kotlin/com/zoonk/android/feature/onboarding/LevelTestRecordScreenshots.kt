package com.zoonk.android.feature.onboarding

import android.Manifest
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.ViewModelProvider
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
import com.zoonk.android.feature.audio.VoiceAnswerModel
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.onboarding.setup.GoalSetupScreen
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.util.ReflectionHelpers
import java.io.File

/**
 * Review screenshots of the level test's speaking step and the line over its Record, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*LevelTestRecordScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LevelTestRecordScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = PHONE)
    fun idlePhone() = capture("level-test-idle-phone")

    @Test
    @Config(qualifiers = WIDE)
    fun idleWide() = capture("level-test-idle-wide")

    @Test
    @Config(qualifiers = PHONE)
    fun recordingPhone() = capture("level-test-recording-phone") { record() }

    @Test
    @Config(qualifiers = PHONE)
    fun noSpeechPhone() =
        capture("level-test-no-speech-phone", ApiException(ApiError.Unavailable, "NO_SPEECH", 422)) {
            takeChecked("We couldn't hear any words. Try again.")
        }

    @Test
    @Config(qualifiers = PHONE)
    fun failedPhone() =
        capture("level-test-failed-phone", ApiException(ApiError.Network)) {
            takeChecked("We couldn't check your answer this time. Try again.")
        }

    @Test
    @Config(qualifiers = PHONE)
    fun signUpPhone() =
        capture(
            "level-test-sign-up-phone",
            ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", 403),
        ) { takeChecked("Create a free account") }

    @Test
    @Config(qualifiers = WIDE)
    fun signUpWide() =
        capture("level-test-sign-up-wide", ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", 403)) {
            takeChecked("Create a free account")
        }

    private fun capture(
        name: String,
        failure: ApiException? = null,
        act: () -> Unit = {},
    ) {
        val api =
            FakeOnboardingApi().apply {
                levelTest = levelTestOf(next = SPEAKING_NEXT, answered = 11)
                setup = {
                    setupView(
                        listOf("placement", "plan"),
                        kind = "language",
                        details = """{"answered":["level","schedule"],"nativeLanguage":"en"}""",
                        targetLanguage = "it",
                    )
                }
            }
        compose.setContent {
            val context = LocalContext.current
            val resources = LocalResources.current
            val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
            val speech =
                remember {
                    val config = resources.getIdentifier("_generated_res_locale_config", "xml", context.packageName)
                    ReflectionHelpers.setField(context.applicationInfo, "localeConfigRes", config)
                    SpeechPlayer(
                        clips = { _, _, _, _ -> throw ApiException(ApiError.Unavailable) },
                        files = VoiceFiles(File(context.cacheDir, "voice"), OkHttpClient(), { false }, session),
                        output =
                            object : AudioOutput {
                                override suspend fun play(
                                    file: File,
                                    rate: Float,
                                    onStart: () -> Unit,
                                ) = PlaybackEnd.Ended

                                override fun stop() = Unit
                            },
                        sessions = session,
                        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                    )
                }
            val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
            val store = remember { OnboardingStore(api, cache, session) { SignInResult.SignedIn } }
            val plans =
                remember {
                    PlanStore(
                        FakePlanApi().apply {
                            shownPlan = planOf()
                            shownSyllabus = syllabusOf(emptyList(), kind = "modules")
                        },
                        cache,
                    )
                }
            ZoonkTheme {
                Surface {
                    CompositionLocalProvider(LocalSetupSpeech provides speech) {
                        GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), store, plans, isGuest = false, rememberAppNavigator())
                    }
                }
            }
        }
        compose.waitForIdle()
        api.writeFailure = failure
        act()
        compose.waitForIdle()
        writeRender(File(folder, "$name.png"), compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun record() {
        shadowOf(compose.activity.application).grantPermissions(Manifest.permission.RECORD_AUDIO)
        compose.onNodeWithText("Record").performClick()
        compose.onNodeWithText("Stop").fetchSemanticsNode()
    }

    private fun takeChecked(shown: String) {
        checkTake("level-test-sentence:$GOAL_ID")
        compose.waitUntil(5_000) { compose.onAllNodesWithText(shown).fetchSemanticsNodes().isNotEmpty() }
    }

    /** Robolectric's recorder records nothing, so the take the learner made is handed to its grading as Stop would. */
    private fun checkTake(key: String) {
        val model = ViewModelProvider(compose.activity)[key, VoiceAnswerModel::class.java]
        val check =
            VoiceAnswerModel::class.java.declaredMethods.first { method ->
                method.parameterTypes.contentEquals(arrayOf(VoiceRecording::class.java))
            }
        compose.runOnUiThread { check.invoke(model, VoiceRecording(ByteArray(64) { 1 }, 1_200)) }
    }

    private companion object {
        const val PHONE = "w411dp-h891dp-xxhdpi"
        const val WIDE = "w1280dp-h800dp-land-xhdpi"
    }
}
