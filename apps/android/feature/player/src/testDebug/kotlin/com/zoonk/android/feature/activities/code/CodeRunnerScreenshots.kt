package com.zoonk.android.feature.activities.code

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.code.ScriptedCodeRuns.Companion.ended
import com.zoonk.android.feature.activities.code.ScriptedCodeRuns.Companion.printed
import com.zoonk.android.feature.player.FakeLessonPlayerApi
import com.zoonk.android.feature.player.LESSON_ID
import com.zoonk.android.feature.player.LessonEnding
import com.zoonk.android.feature.player.LessonPlayer
import com.zoonk.android.feature.player.LessonPlayerExits
import com.zoonk.android.feature.player.LessonPlayerStore
import com.zoonk.android.feature.player.LessonPlayerViewModel
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.playable
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** A code runner step after Run: [updates] is how the run went, null for a step nobody ran; [holds] keeps it going. */
private class Scene(
    val name: String,
    val updates: List<CodeRunUpdate>?,
    val holds: Boolean = false,
    val python: Boolean = false,
)

private fun refused(
    status: Int,
    code: String,
    details: String? = null,
) = CodeRunUpdate.Ended(MutationResult.Failed(ApiError.Unavailable, code, status, details?.let(Json::parseToJsonElement)))

private const val COMPILER_ERROR =
    "Main.java:4: error: ';' expected\n        for (int n = 1; n < 100; n++) total += n\n                                                ^\n1 error\n"

private val scenes =
    listOf(
        Scene("java-idle", updates = null),
        Scene("java-starting", emptyList(), holds = true),
        Scene("java-compiling", listOf(CodeRunUpdate.Phase(CodeRunPhase.Compiling)), holds = true),
        Scene("java-running", listOf(CodeRunUpdate.Phase(CodeRunPhase.Running)), holds = true),
        Scene("java-done", listOf(ended(printed("5050\n")))),
        Scene("java-wrong-output", listOf(ended(printed("4950\n")))),
        Scene("java-compile-error", listOf(ended(printed("", ProgramStop.Error, ProgramError(4, "';' expected"), COMPILER_ERROR)))),
        Scene("java-timeout", listOf(ended(printed("", ProgramStop.Timeout)))),
        Scene("java-too-much-output", listOf(ended(printed("1\n1\n1\n", ProgramStop.TooMuchOutput)))),
        Scene("java-offline", listOf(CodeRunUpdate.Ended(MutationResult.Failed(ApiError.Network)))),
        Scene("java-unavailable", listOf(ended(printed("", ProgramStop.Unavailable)))),
        Scene("java-sign-up-required", listOf(refused(403, "SIGN_UP_REQUIRED"))),
        Scene("java-free-limit", listOf(refused(402, "USAGE_LIMIT_REACHED", """{"limit":{"tier":"free"}}"""))),
        Scene("java-slow-down", listOf(refused(429, "SLOW_DOWN", """{"retryAfterSeconds":30}"""))),
        Scene("python-idle", updates = null, python = true),
        Scene("python-done", emptyList(), python = true),
    )

/**
 * Review screenshots of a code runner in a lesson, in each state a run on our servers goes through and as a Python step
 * the device runs, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*CodeRunnerScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CodeRunnerScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val temporary = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun tablet() = capture("tablet")

    private fun capture(
        size: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope)
        val sandbox = ScriptedSandbox(scope) { ScriptedSandbox.printed("5050\n") }.sandbox
        val runs = ScriptedCodeRuns()
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }
        var index by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalCodeSandbox provides sandbox,
                    LocalCodeRuns provides runs,
                ) {
                    key(index) {
                        val scene = scenes[index]
                        val step =
                            if (scene.python) {
                                ActivityFixtures.step(
                                    "codeRunner",
                                    id = scene.name,
                                )
                            } else {
                                JavaCodeRunner.step(scene.name)
                            }
                        val lesson = remember { playable(listOf(step)) }
                        val viewModel =
                            remember {
                                LessonPlayerViewModel(
                                    LESSON_ID,
                                    null,
                                    null,
                                    LessonPlayerStore(FakeLessonPlayerApi(LessonLoad.Ready(lesson)), cache),
                                    cache,
                                    session,
                                    TodayChoices(drafts),
                                    drafts,
                                    saved = SavedStateHandle(),
                                    tapped = true,
                                )
                            }
                        val state by viewModel.state.collectAsState()
                        val ending by viewModel.ending.collectAsState()
                        LaunchedEffect(Unit) { viewModel.open(lesson) }
                        state?.let { LessonPlayer(lesson, it, ending, viewModel, exits, rememberAppNavigator()) }
                    }
                }
            }
        }
        scenes.forEachIndexed { at, scene ->
            runs.updates = scene.updates.orEmpty()
            runs.gate = if (scene.holds) CompletableDeferred() else null
            index = at
            compose.waitForIdle()
            if (scene.updates != null) {
                compose.onNodeWithText("Run").performClick()
                compose.mainClock.advanceTimeBy(PAST_PHASE_DELAY)
                compose.waitForIdle()
            }
            write("${scene.name}-$size", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
        println("Screenshot ${file.path}")
    }

    private companion object {
        const val PAST_PHASE_DELAY = 600L
    }
}
