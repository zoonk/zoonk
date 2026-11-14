package com.zoonk.android.feature.checkpoint

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.ceremonies.MomentBuddy
import com.zoonk.android.feature.practice.studyFeedback
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the checkpoint duel, written only on demand:
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*CheckpointScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CheckpointScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun show(
        name: String,
        checkpoint: Checkpoint = checkpoint(),
        feedback: (StudyAnswerInput) -> StudyAnswerFeedback = { studyFeedback(isCorrect = true) },
        play: () -> Unit = {},
    ) {
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = checkpoint

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ) = feedback(input)

                override suspend fun finish(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    timeZone: String,
                ): StudyBlockCompletion = error("Not used")
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = CheckpointViewModel(checkpoint.blockId, CheckpointStore(api, cache) { "UTC" })
        runBlocking { viewModel.checkpoint.load() }
        viewModel.begin((viewModel.checkpoint.state.value as LoadState.Loaded).value)

        rule.setContent {
            ZoonkTheme {
                val duel by viewModel.duel.collectAsStateWithLifecycle()
                duel?.let {
                    val app = AppContainer.preview(rule.activity)
                    if (it.state.showsResult) DuelResult(it, viewModel, app, ZU) else DuelPlay(it, viewModel, app)
                }
            }
        }
        play()
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun confirm() {
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Confirm").performClick()
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xxhdpi")
    fun bookRight() =
        show("book-right") {
            rule.unfoldBook(folds)
            confirm()
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneDuel() = show("phone-duel")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWrong() = show("phone-wrong", feedback = { studyFeedback(isCorrect = false) }, play = ::confirm)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLost() =
        show("phone-lost", checkpoint(duelQuestion(Q1, answered = false), duelQuestion(Q2), duelQuestion(Q3)), feedback = {
            studyFeedback(isCorrect = false)
        }, play = ::confirm)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRight() = show("tablet-right", play = ::confirm)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWeekly() = show("phone-weekly", checkpoint(kind = "weekly"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultLostEarlier() =
        show(
            "phone-result-lost",
            checkpoint(
                fields =
                    arrayOf(
                        "status" to "completed",
                        "retry" to "tomorrow",
                        "reinforcementLessons" to 2,
                        "result" to
                            kotlinx.serialization.json.JsonObject(
                                mapOf(
                                    "correct" to kotlinx.serialization.json.JsonPrimitive(1),
                                    "passed" to kotlinx.serialization.json.JsonPrimitive(false),
                                    "total" to kotlinx.serialization.json.JsonPrimitive(3),
                                ),
                            ),
                    ),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultWon() = showWon("phone-result-won")

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultWon() = showWon("book-result-won", play = { rule.unfoldBook(folds) })

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletResultWon() = showWon("tablet-result-won")

    private fun showWon(
        name: String,
        play: () -> Unit = {},
    ) = show(
        name,
        checkpoint(
            fields =
                arrayOf(
                    "status" to "completed",
                    "result" to
                        JsonObject(mapOf("correct" to JsonPrimitive(2), "passed" to JsonPrimitive(true), "total" to JsonPrimitive(3))),
                    "nextPhase" to JsonObject(mapOf("index" to JsonPrimitive(1), "name" to JsonPrimitive("Energy"))),
                    "reward" to
                        JsonObject(
                            mapOf(
                                "badge" to JsonPrimitive(true),
                                "brainPower" to JsonPrimitive(30),
                                "glasses" to kotlinx.serialization.json.JsonNull,
                                "phaseComplete" to JsonPrimitive(true),
                            ),
                        ),
                ),
        ),
        play = play,
    )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAnswerNotSaved() =
        show("phone-not-saved", feedback = {
            throw com.zoonk.android.data
                .ApiException(com.zoonk.android.data.ApiError.Network)
        }, play = ::confirm)

    private val defaultAnswers =
        JsonArray(
            listOf(Q1, Q2).mapIndexed { index, id ->
                JsonObject(
                    mapOf(
                        "correctAnswer" to JsonObject(mapOf("selectedIndex" to JsonPrimitive(0))),
                        "explanation" to JsonPrimitive("Mars orbits the Sun; the Moon orbits Earth."),
                        "isCorrect" to JsonPrimitive(index == 0),
                        "itemId" to JsonPrimitive(id),
                        "workedSteps" to JsonArray(emptyList()),
                    ),
                )
            },
        )

    private fun mathQuestion(
        id: String,
        format: String,
        question: String,
        options: List<String>? = null,
    ) = fixture(
        "checkpoint-question",
        "itemId" to id,
        "format" to format,
        "question" to question,
        "options" to options?.let { JsonArray(it.map(::JsonPrimitive)) },
    )

    private fun reviewAnswer(
        id: String,
        correct: Pair<String, JsonPrimitive>,
        isCorrect: Boolean,
        explanation: String,
    ) = JsonObject(
        mapOf(
            "correctAnswer" to JsonObject(mapOf(correct)),
            "explanation" to JsonPrimitive(explanation),
            "isCorrect" to JsonPrimitive(isCorrect),
            "itemId" to JsonPrimitive(id),
            "workedSteps" to JsonArray(emptyList()),
        ),
    )

    /** Math, a long formula, a number, a typed name and a true/false answer, as #2770 draws them. */
    private val mathRead =
        checkpoint(
            mathQuestion(
                M1,
                "multipleChoice",
                "Quais são as raízes de \$x^2 - 5x + 6 = 0\$?",
                listOf("\$x = 2\$ e \$x = 3\$", "\$x = 1\$ e \$x = 6\$"),
            ),
            mathQuestion(
                M2,
                "multipleChoice",
                "Qual expressão dá as raízes de \$ax^2 + bx + c = 0\$?",
                listOf(
                    "\$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a} \\\\text{, com } a \\\\neq 0 \\\\text{ e } \\\\Delta = b^2 - 4ac \\\\geq 0\$",
                    "\$x = \\\\frac{b \\\\pm \\\\sqrt{b^2 + 4ac}}{2a}\$",
                ),
            ),
            mathQuestion(M3, "numeric", "Quanto é \$\\\\frac{3}{4}\$ de \$80\$?"),
            mathQuestion(M4, "typed", "Que método inicia um objeto em Python?"),
            mathQuestion(M5, "trueFalse", "\$25\\\\%\$ de \$80\$ é \$25\$."),
        )

    private val mathAnswers =
        JsonArray(
            listOf(
                reviewAnswer(M1, "selectedIndex" to JsonPrimitive(0), true, "Fatorando, \$(x - 2)(x - 3) = 0\$."),
                reviewAnswer(M2, "selectedIndex" to JsonPrimitive(0), false, "É a fórmula de Bhaskara."),
                reviewAnswer(M3, "number" to JsonPrimitive(60), false, "\$\\\\frac{3}{4} \\\\times 80 = 60\$."),
                reviewAnswer(M4, "text" to JsonPrimitive("__init__"), false, "O nome tem dois sublinhados de cada lado."),
                reviewAnswer(M5, "isTrue" to JsonPrimitive(false), true, "\$25\\\\%\$ de \$80\$ é \$20\$."),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xxhdpi")
    fun phoneResultMath() = showResult("checkpoint-math-phone", mathRead, answers = mathAnswers, openReview = true)

    @Test
    @Config(qualifiers = "w411dp-h2400dp-night-xxhdpi")
    fun phoneResultMathDark() = showResult("checkpoint-math-phone-dark", mathRead, dark = true, answers = mathAnswers, openReview = true)

    @Test
    @Config(qualifiers = "w360dp-h2400dp-xxhdpi")
    fun narrowResultMath() = showResult("checkpoint-math-narrow", mathRead, answers = mathAnswers, openReview = true)

    @Test
    @Config(qualifiers = "w1280dp-h1600dp-night-xhdpi")
    fun tabletResultMathDark() = showResult("checkpoint-math-tablet-dark", mathRead, dark = true, answers = mathAnswers)

    private fun showResult(
        name: String,
        read: Checkpoint = checkpoint(),
        ended: JsonObject = JsonObject(lostBoss),
        fold: Boolean = false,
        dark: Boolean = false,
        rightToLeft: Boolean = false,
        answers: JsonArray = defaultAnswers,
        openReview: Boolean = false,
    ) {
        val completion: StudyBlockCompletion =
            com.zoonk.android.feature.session.decodeFixture(
                "study-block-completion",
                "checkpoint" to JsonObject(ended + ("answers" to answers)),
                "missions" to missions,
                "completedMissions" to JsonArray(listOf(JsonPrimitive("challenge"))),
                "reached" to
                    JsonObject(
                        mapOf(
                            "energy" to JsonPrimitive(64),
                            "level" to JsonObject(mapOf("color" to JsonPrimitive("yellow"), "level" to JsonPrimitive(3))),
                        ),
                    ),
            )
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = read

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ): StudyAnswerFeedback = error("Not used")

                override suspend fun finish(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    timeZone: String,
                ): StudyBlockCompletion = error("Not used")
            }
        val viewModel = CheckpointViewModel(read.blockId, CheckpointStore(api, cache) { "UTC" })
        val duel = Duel(read.read(), DuelState.of(read).finished(completion))
        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = dark) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rightToLeft) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    DuelResult(duel, viewModel, AppContainer.preview(rule.activity), ZU)
                }
            }
        }
        if (fold) rule.unfoldBook(folds)
        rule.mainClock.advanceTimeBy(10_000)
        rule.waitForIdle()
        if (openReview) {
            rule.onNodeWithText("Review the answers").performClick()
            rule.mainClock.advanceTimeBy(1_000)
            rule.waitForIdle()
        }
        val bitmap = (if (openReview) rule.onNode(isDialog()) else rule.onRoot()).captureRender().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletResultLost() = showResult("tablet-result-lost")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultLostFresh() = showResult("phone-result-lost-fresh")

    private val lostBoss =
        mapOf(
            "correct" to JsonPrimitive(1),
            "kind" to JsonPrimitive("boss"),
            "passMark" to JsonPrimitive(2),
            "passed" to JsonPrimitive(false),
            "total" to JsonPrimitive(3),
        )

    private val weeklyDone =
        mapOf(
            "correct" to JsonPrimitive(3),
            "kind" to JsonPrimitive("weekly"),
            "passMark" to JsonPrimitive(0),
            "passed" to JsonPrimitive(true),
            "total" to JsonPrimitive(3),
        )

    private val noReward =
        "reward" to
            JsonObject(
                mapOf(
                    "badge" to JsonPrimitive(false),
                    "brainPower" to JsonPrimitive(30),
                    "glasses" to kotlinx.serialization.json.JsonNull,
                    "phaseComplete" to JsonPrimitive(false),
                ),
            )

    private val weekly = checkpoint(kind = "weekly", fields = arrayOf(noReward))

    private val missions =
        JsonArray(
            listOf("challenge" to "done", "review" to "todo").map { (kind, status) ->
                JsonObject(
                    mapOf(
                        "done" to JsonPrimitive(if (status == "done") 1 else 0),
                        "kind" to JsonPrimitive(kind),
                        "status" to JsonPrimitive(status),
                        "total" to JsonPrimitive(1),
                    ),
                )
            },
        )

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultLostFresh() = showResult("book-result-lost-fresh", fold = true)

    @Test
    @Config(qualifiers = SMALL_BOOK)
    fun smallBookResultLostFresh() = showResult("small-book-result-lost-fresh", fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultWeeklyFresh() = showResult("book-result-weekly-fresh", weekly, JsonObject(weeklyDone), fold = true)

    @Test
    @Config(qualifiers = SMALL_BOOK)
    fun smallBookResultWeeklyFresh() = showResult("small-book-result-weekly-fresh", weekly, JsonObject(weeklyDone), fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultWeeklyFreshRightToLeft() =
        showResult("book-result-weekly-fresh-rtl", weekly, JsonObject(weeklyDone), fold = true, rightToLeft = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultWeeklyFreshDark() =
        showResult("book-result-weekly-fresh-dark-more-contrast", weekly, JsonObject(weeklyDone), fold = true, dark = true)

    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun bookResultWeeklyFreshLargeFont() = showResult("book-result-weekly-fresh-font200", weekly, JsonObject(weeklyDone), fold = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultWeeklyFresh() = showResult("phone-result-weekly-fresh", weekly, JsonObject(weeklyDone))

    @Test
    @Config(qualifiers = MEDIUM)
    fun mediumResultWeeklyFresh() = showResult("medium-result-weekly-fresh", weekly, JsonObject(weeklyDone))

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletResultWeeklyFresh() = showResult("tablet-result-weekly-fresh", weekly, JsonObject(weeklyDone))

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultWeeklyAgain() =
        show(
            "book-result-weekly-again",
            checkpoint(
                kind = "weekly",
                fields = arrayOf(noReward, "status" to "completed", "result" to JsonObject(weeklyDone - "kind" - "passMark")),
            ),
            play = { rule.unfoldBook(folds) },
        )

    @Test
    @Config(qualifiers = BOOK)
    fun bookResultRemoved() =
        show(
            "book-result-removed",
            checkpoint(fields = arrayOf("status" to "skipped", "endedWithoutQuestions" to true)),
            play = { rule.unfoldBook(folds) },
        )

    @Test
    @Config(qualifiers = BOOK)
    fun bookQuestionsRemoved() = show("book-questions-removed", checkpoint(*emptyArray<JsonObject>()), play = { rule.unfoldBook(folds) })
}

private const val BOOK = "w852dp-h883dp-xhdpi"
private const val SMALL_BOOK = "w707dp-h823dp-xhdpi"
private const val MEDIUM = "w700dp-h840dp-xhdpi"

private val ZU = MomentBuddy(BuddyLook(), "Zu")

private const val M1 = "00000000-0000-4000-8000-0000000000a1"
private const val M2 = "00000000-0000-4000-8000-0000000000a2"
private const val M3 = "00000000-0000-4000-8000-0000000000a3"
private const val M4 = "00000000-0000-4000-8000-0000000000a4"
private const val M5 = "00000000-0000-4000-8000-0000000000a5"
