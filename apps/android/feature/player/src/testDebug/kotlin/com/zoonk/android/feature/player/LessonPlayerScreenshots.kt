package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.activities.choiceAnswer
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.SpokenAnswerGrade
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
import kotlin.time.Instant

/**
 * Review screenshots of the lesson player, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*LessonPlayerScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonPlayerScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
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
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBook() = capture("small-book", fold = true)

    private val steps =
        listOf(
            hookGuessStep("hook"),
            explanationStep("idea", visual = RIDERSHIP),
            workedExampleStep("worked"),
            checkStep("quiz"),
            typedAnswerStep("why"),
            spokenStep("say"),
            activityStep("act"),
            challengeStep("case"),
            summaryStep("end"),
        )

    private fun at(vararg actions: LessonAction): LessonPlayerState {
        val started =
            reduce(
                LessonPlayerState.initial(LESSON_ID, steps, now = 0),
                LessonAction.RunStarted(RUN_ID, emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-10-28T10:00:00Z")),
                0,
            )
        return actions.fold(started) { state, action -> reduce(state, action, 0) }
    }

    private val states: List<Pair<String, () -> LessonPlayerState>> =
        listOf(
            "hook-picked" to { at(LessonAction.SelectAnswer("hook", LessonAnswer.Hook("yes"))) },
            "hook-revealed" to {
                at(
                    LessonAction.SelectAnswer("hook", LessonAnswer.Hook("yes")),
                    LessonAction.CheckResolved("hook", checkResult(false, "No, and here's why.").toStepResult("Yes"), counts = false),
                )
            },
            "explanation" to { at(*pastHook()) },
            "worked-example" to { at(*toWorked(), LessonAction.Continue) },
            "check-wrong" to {
                val wrong = checkResult(false, "That's the trap.").toStepResult("Wrong").copy(correctAnswer = "Right")
                at(
                    *toQuiz(),
                    LessonAction.SelectAnswer("quiz", LessonAnswer.Check("wrong")),
                    LessonAction.CheckResolved("quiz", wrong, counts = true),
                )
            },
            "typed" to
                {
                    at(
                        *toQuiz(),
                        LessonAction.SkipSteps(listOf("quiz")),
                        LessonAction.SelectAnswer("why", LessonAnswer.Typed("Water droplets float")),
                    )
                },
            "typed-checked" to {
                val graded =
                    checkResult(
                        true,
                        "You named it.",
                        keyPoints = """[{"met":true,"text":"Names the cloud"},{"met":false,"text":"Says why it floats"}]""",
                    ).toStepResult("Water droplets float")
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz")),
                    LessonAction.SelectAnswer("why", LessonAnswer.Typed("Water droplets float")),
                    LessonAction.CheckStarted("why"),
                    LessonAction.CheckResolved("why", graded, counts = true),
                )
            },
            "typed-wrong" to {
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz")),
                    LessonAction.SelectAnswer("why", LessonAnswer.Typed("Rain")),
                    LessonAction.CheckStarted("why"),
                    LessonAction.CheckResolved("why", checkResult(false).toStepResult("Rain"), counts = true),
                )
            },
            "missed-twice" to {
                at(
                    *toQuiz(),
                    LessonAction.SelectAnswer("quiz", LessonAnswer.Check("wrong")),
                    LessonAction.CheckResolved("quiz", checkResult(false).toStepResult("Wrong"), counts = true),
                    LessonAction.Continue,
                    LessonAction.SelectAnswer("why", LessonAnswer.Typed("Rain")),
                    LessonAction.CheckStarted("why"),
                    LessonAction.CheckResolved("why", checkResult(false).toStepResult("Rain"), counts = true),
                )
            },
            "spoken-heard" to {
                val heard =
                    ApiJson
                        .decodeFromString(
                            SpokenAnswerGrade.serializer(),
                            """
                            {"attemptId":"00000000-0000-4000-8000-000000000021","explanation":"Say the h softly, almost silent.","isCorrect":false,"score":0.5,
                             "transcript":"Tengo ambre","words":[{"heard":"Tengo","status":"correct","text":"Tengo"},{"heard":"ambre","status":"different","text":"hambre"}],
                             "wordsToPractice":[{"audioUrl":null,"heard":"ambre","respelling":"AHM-breh","status":"different","text":"hambre","tip":"The h is silent in Spanish."}]}
                            """.trimIndent(),
                        ).toStepResult("Tengo hambre")
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz", "why")),
                    LessonAction.CheckStarted("say"),
                    LessonAction.CheckResolved("say", heard, counts = true),
                )
            },
            "activity-checked" to {
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz", "why", "say")),
                    LessonAction.SelectAnswer("act", LessonAnswer.Activity(choiceAnswer("b"))),
                    LessonAction.CheckStarted("act"),
                    LessonAction.CheckResolved("act", checkResult(false).toStepResult(null), counts = true),
                )
            },
            "challenge-intro" to { at(*toQuiz(), LessonAction.SkipSteps(listOf("quiz", "why", "say", "act"))) },
            "challenge-deciding" to {
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz", "why", "say", "act")),
                    LessonAction.Continue,
                    LessonAction.SelectAnswer("case", LessonAnswer.Challenge(listOf("ask"))),
                )
            },
            "challenge-debrief" to {
                at(
                    *toQuiz(),
                    LessonAction.SkipSteps(listOf("quiz", "why", "say", "act")),
                    LessonAction.Continue,
                    LessonAction.SelectAnswer("case", LessonAnswer.Challenge(listOf("quote"))),
                    LessonAction.Continue,
                    LessonAction.CheckResolved("case", stepResult(false), counts = true),
                )
            },
            "free-limit" to { at(LessonAction.RunRefused(LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Day)))) },
            "slow-down" to { at(LessonAction.RunRefused(LessonRefusal.Limited(Limit.SlowDown(30)))) },
            "not-found" to { at(LessonAction.RunRefused(LessonRefusal.NotFound)) },
            "finish-ready" to { LessonPlayerState.initial(LESSON_ID, emptyList(), now = 0) },
            "completed" to { completed(COMPLETION) },
            "completed-reached" to {
                completed(
                    COMPLETION.replace(
                        """"reached":{"energy":null,"level":null}""",
                        """"reached":{"energy":80,"level":{"color":"yellow","level":3}}""",
                    ),
                )
            },
        )

    private fun completed(json: String) =
        at(
            *toQuiz(),
            LessonAction.SelectAnswer("quiz", LessonAnswer.Check("right")),
            LessonAction.CheckResolved("quiz", checkResult(true).toStepResult("Right"), counts = true),
            LessonAction.Continue,
            LessonAction.SkipSteps(listOf("why", "say", "act", "case")),
            LessonAction.Continue,
            LessonAction.CompletionSaved(ApiJson.decodeFromString(LibraryLessonCompletion.serializer(), json)),
        )

    private fun pastHook() =
        arrayOf(
            LessonAction.SelectAnswer("hook", LessonAnswer.Hook("no")),
            LessonAction.CheckResolved("hook", checkResult(true, "No, and here's why.").toStepResult("No"), counts = false),
            LessonAction.Continue,
        )

    private fun toWorked() = arrayOf(*pastHook(), LessonAction.Continue)

    private fun toQuiz() = arrayOf(*toWorked(), LessonAction.Continue, LessonAction.Continue, LessonAction.Continue)

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope)
        val viewModel =
            LessonPlayerViewModel(
                LESSON_ID,
                null,
                null,
                LessonPlayerStore(FakeLessonPlayerApi(LessonLoad.Ready(playable(steps))), cache),
                cache,
                session,
                TodayChoices(drafts),
                drafts,
                saved = SavedStateHandle(),
            )
        val lesson = playable(steps)
        var index by mutableIntStateOf(0)
        val tutor = LessonTutor(TutorIdentity("Sam", look = null)) { _, _, _, _, _, _ -> }
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    key(index) {
                        LessonPlayer(
                            lesson,
                            states[index].second(),
                            LessonEnding(),
                            viewModel,
                            exits,
                            rememberAppNavigator(),
                            tutor = tutor,
                        )
                    }
                }
            }
        }
        states.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            // Each state composes the player anew, and the publisher only tells what's listening when it publishes.
            if (fold) {
                folds.overrideWindowLayoutInfo(
                    TestWindowLayoutInfo(
                        listOf(
                            FoldingFeature(
                                compose.activity,
                                state = FoldingFeature.State.FLAT,
                                orientation = FoldingFeature.Orientation.VERTICAL,
                            ),
                        ),
                    ),
                )
                compose.waitForIdle()
            }
            write("${states[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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

private val RIDERSHIP: StepVisual =
    ApiJson.decodeFromString(
        """
        {"kind":"chart","chart":"bar","title":"Riders per day","categoryLabel":"Line","valueLabel":"Riders",
        "categories":["Blue","Red","Green"],"series":[{"name":"2025","values":[1200,800,450]}]}
        """,
    )
