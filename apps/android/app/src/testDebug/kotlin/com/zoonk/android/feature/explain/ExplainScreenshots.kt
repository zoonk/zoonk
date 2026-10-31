package com.zoonk.android.feature.explain

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.player.COMPLETION
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.checkStep
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Explanation
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LibraryLessonCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import kotlin.time.Instant

private const val GOAL_ID = "00000000-0000-4000-8000-000000000031"
private const val LESSON_ID = "00000000-0000-4000-8000-000000000032"
private const val OUTLINE =
    """["Light is a mix of colors","Air scatters short waves most","Blue wins the sky",
       "Why sunsets turn red","What the check asks"]"""
private const val RECAP =
    """["Sunlight holds every color.","Air scatters blue light the most.",
       "So blue reaches your eyes from every direction."]"""
private const val LESSON =
    """{"id":"$LESSON_ID","title":"Why is the sky blue?","description":"Light and air.","estimatedMinutes":5,"language":"en",
       "level":"overview","skills":[],"steps":[],"summaryIdeas":[],"targetLanguage":null,"canDo":null,"chapter":null}"""

private fun explanation(
    outline: String = "[]",
    lesson: String? = null,
    recap: String = "[]",
    questions: String = "[]",
): Explanation =
    ApiJson.decodeFromString(
        Explanation.serializer(),
        """
        {"generationId":"gen-1","goFurther":{"course":null,"questions":$questions},"goalId":"$GOAL_ID","hasStudyGoal":true,
         "lesson":${lesson ?: "null"},"outline":$outline,"question":"Why is the sky blue?","recap":$recap,
         "status":"${if (lesson == null) "preparing" else "ready"}","title":"Why is the sky blue?"}
        """.trimIndent(),
    )

/**
 * Review screenshots of a quick explanation, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*ExplainScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ExplainScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

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
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    private val written =
        explanation(
            outline = OUTLINE,
            lesson = LESSON,
            recap = RECAP,
            questions = """["Why are sunsets red?","Why is the ocean blue?"]""",
        )

    private fun completed(): LessonPlayerState {
        val steps = listOf(checkStep("quiz"))
        return listOf(
            LessonAction.RunStarted("run", emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-10-29T10:00:00Z")),
            LessonAction.SelectAnswer("quiz", LessonAnswer.Check("right")),
            LessonAction.CheckResolved("quiz", checkResult(true).toStepResult("Right"), counts = true),
            LessonAction.Continue,
            LessonAction.CompletionSaved(ApiJson.decodeFromString(LibraryLessonCompletion.serializer(), COMPLETION)),
        ).fold(LessonPlayerState.initial(LESSON_ID, steps, now = 0)) { state, action -> reduce(state, action, 0) }
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val api =
            object : ExplainApi {
                override suspend fun explanation(
                    session: AuthenticatedSession,
                    goalId: String,
                ) = written

                override suspend fun writeAgain(
                    session: AuthenticatedSession,
                    goalId: String,
                ) = "gen-2"

                override suspend fun recordWait(
                    session: AuthenticatedSession,
                    milliseconds: Long,
                ) = Unit
            }
        val writing =
            object : GenerationSource {
                override fun events(id: String) =
                    flow {
                        emit(GenerationEvent(status = "completed", step = "classifyQuestion"))
                        emit(GenerationEvent(status = "completed", step = "findExplanation"))
                        emit(GenerationEvent(status = "started", step = "writeExplanation"))
                        awaitCancellation()
                    }

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        val viewModel = ExplainViewModel(GOAL_ID, ExplainStore(api, cache), cache, session, { writing })
        val screens =
            listOf<Pair<String, @androidx.compose.runtime.Composable () -> Unit>>(
                "writing" to { ExplainWaiting(explanation(), viewModel, rememberAppNavigator(), readAgain = {}, onStart = {}) },
                "outline" to
                    { ExplainWaiting(explanation(outline = OUTLINE), viewModel, rememberAppNavigator(), readAgain = {}, onStart = {}) },
                "written" to { ExplainWaiting(written, viewModel, rememberAppNavigator(), readAgain = {}, onStart = {}) },
                "ending" to {
                    Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        ExplainEnding(written, completed(), rememberAppNavigator(), readAgain = {})
                    }
                },
            )
        var index by mutableIntStateOf(0)

        viewModel.show(explanation())
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(color = MaterialTheme.colorScheme.surface) { key(index) { screens[index].second() } }
            }
        }
        screens.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("explain-${screens[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}
