package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.player.language.step
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.toLessonAnswer
import com.zoonk.android.feature.tutor.TutorAvatar
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LessonStepCheckResult
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
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of the lesson's match screens (the activity and the language step) as the learner taps through
 * them, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*MatchStepScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MatchStepScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val temporary = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val exchanges =
        listOf(
            "a" to
                ("A: Martedì per me è impossibile. B: Giovedì invece non ho impegni." to "Perfetto, allora ci vediamo giovedì pomeriggio."),
            "b" to ("A: Sei libero sabato sera? B: Purtroppo lavoro fino alle dieci." to "Peccato, facciamo domenica a pranzo?"),
            "c" to
                (
                    "A: Ti va un caffè dopo la lezione? B: Volentieri, ma devo uscire alle cinque." to
                        "Va bene, allora andiamo al bar qui di fronte."
                ),
            "d" to ("A: Hai già prenotato il ristorante? B: No, me ne sono dimenticato." to "Non importa, chiamo io domani mattina."),
        )

    private val activity: LessonStep by lazy {
        val pairs =
            exchanges.joinToString(",", "[", "]") { (id, pair) ->
                """{"id":"$id","left":"${pair.first}","right":"${pair.second}","why":"Each reply answers the last line of its exchange."}"""
            }
        ActivityFixtures.step(
            ApiJson.parseToJsonElement(
                """{"check":{"explanation":"Each reply answers the last line of its exchange.","kind":"interaction"},
                   "fields":{"distractors":[],"pairs":$pairs},"prompt":"Match each exchange with the reply that follows it.","template":"matchPairs"}""",
            ),
            id = "act",
        )
    }

    private val rent =
        listOf(
            "rent" to "aluguel",
            "landlord" to "proprietário",
            "deposit" to "caução",
            "lease" to "contrato de aluguel",
            "tenant" to "inquilino",
        )

    private val columns =
        step(
            "cols",
            StepKind.MatchColumns,
            "matchColumns",
            content = rent.joinToString(",", """{"pairs":[""", "]}") { (left, right) -> """{"left":"$left","right":"$right"}""" },
            rightItems =
                listOf(
                    "inquilino",
                    "caução",
                    "aluguel",
                    "contrato de aluguel",
                    "proprietário",
                ).joinToString(",", "[", "]") { "\"$it\"" },
        )

    private var scene by mutableStateOf<Pair<String, @Composable () -> Unit>?>(null)

    private fun start(dark: Boolean) {
        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalPrivatePictures provides null,
                    LocalLessonSpeech provides previewSpeech(),
                ) { scene?.let { (name, content) -> key(name) { content() } } }
            }
        }
    }

    private fun show(
        name: String,
        step: LessonStep,
        taps: List<String>,
        settle: Boolean = true,
        check: Boolean = false,
        unsettled: Long = FRAME * 4,
    ) {
        val lesson = playable(listOf(step)).copy(targetLanguage = "pt")
        val api = FakeLessonPlayerApi(LessonLoad.Ready(lesson))
        api.grade = { _, input -> graded(input.answer.toLessonAnswer()) }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope, io = Dispatchers.Main.immediate)
        runBlocking { drafts.follow { DraftsChange(ANA) } }
        val viewModel =
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = null,
                firstAnswer = null,
                opening = null,
                tapped = false,
                store = LessonPlayerStore(api, cache),
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                saved = SavedStateHandle(),
            )
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }
        rule.mainClock.autoAdvance = true
        scene =
            name to {
                val state by viewModel.state.collectAsState()
                val ending by viewModel.ending.collectAsState()
                LaunchedEffect(Unit) { viewModel.open(lesson) }
                LessonPlayer(lesson, state, ending, viewModel, exits, rememberAppNavigator(), tutor = tutor)
            }
        rule.waitForIdle()
        if (!settle) rule.mainClock.autoAdvance = false
        taps.forEach { text ->
            rule.onNode(hasClickAction() and hasText(text)).performScrollTo().performClick()
            rule.mainClock.advanceTimeBy(FRAME)
        }
        if (check) {
            rule.onAllNodes(hasText("Check") and isEnabled()).fetchSemanticsNodes().firstOrNull()?.let {
                rule.onNode(hasText("Check") and isEnabled()).performClick()
            }
        }
        // A wrong try's cue outlasts its shake, which is all idling waits for.
        if (settle) rule.mainClock.advanceTimeBy(CUE) else rule.mainClock.advanceTimeBy(unsettled)
        if (settle) rule.waitForIdle()
        writeRender(File(folder, "$name.png").apply { parentFile?.mkdirs() }, rule.onRoot().captureRender().asAndroidBitmap())
    }

    /** As the server grades a board: right only when every first try was its pair, a miss saved to the learner's mistakes. */
    private fun graded(answer: LessonAnswer): LessonStepCheckResult {
        val isCorrect =
            when (answer) {
                is LessonAnswer.MatchColumns -> answer.mistakes == 0
                is LessonAnswer.Activity -> answer.answer.assignmentPairs?.all { (left, right) -> left == right } == true
                else -> true
            }
        return ApiJson.decodeFromString(
            """{"checked":true,"correctAnswer":null,"corrections":[],"expected":null,"feedback":null,"isCorrect":$isCorrect,
               "keyPoints":null,"savedMistake":${!isCorrect},"score":null,"spelling":null}""",
        )
    }

    /** The lesson's buddy, as a learner's summary gives it, with its ask at the bar's end. */
    private val tutor: LessonTutor by lazy {
        val buddy =
            ApiJson.decodeFromString<LearnerSummaryBuddy>(
                """{"beltColor":"white","energy":null,"glasses":"round","kind":"zu","name":null,"studiedToday":false}""",
            )
        val identity = TutorIdentity("Zu", buddy.look())
        LessonTutor(identity) { _, _, _, _, _ -> OutlinedIconButton(onClick = {}) { TutorAvatar(identity, 24.dp) } }
    }

    private fun left(id: String) = exchanges.first { it.first == id }.second.first

    private fun right(id: String) = exchanges.first { it.first == id }.second.second

    private fun states(
        suffix: String,
        dark: Boolean,
    ) {
        start(dark)
        show("activity-untouched$suffix", activity, emptyList())
        show("activity-selected$suffix", activity, listOf(left("a")))
        show("activity-miss$suffix", activity, listOf(left("a"), right("b")), settle = false)
        show("activity-miss-settled$suffix", activity, listOf(left("a"), right("b")))
        show("activity-locked-cue$suffix", activity, listOf(left("a"), right("a")), settle = false)
        show("activity-midway$suffix", activity, listOf(left("a"), right("a"), left("b"), right("b")))
        // The first card stays picked after its miss, so its partner is one tap away.
        val solved = listOf(left("a"), right("b"), right("a"), left("b"), right("b"), left("c"), right("c"), left("d"), right("d"))
        show("activity-solved$suffix", activity, solved, check = true)
        show("columns-untouched$suffix", columns, emptyList())
        show("columns-selected$suffix", columns, listOf("landlord"))
        show("columns-miss$suffix", columns, listOf("landlord", "caução"), settle = false)
        show("columns-miss-settled$suffix", columns, listOf("landlord", "caução"))
        show("columns-midway$suffix", columns, listOf("rent", "aluguel", "landlord", "caução", "proprietário"))
        val all = rent.flatMap { (left, right) -> listOf(left, right) }
        show("columns-solved$suffix", columns, all)
        // Mid-slide: the last pair just made, the cards on their way to their rows.
        show("columns-sliding$suffix", columns, all, settle = false, unsettled = FRAME)
        // The first card stays picked after its miss, so its partner is one tap away.
        show("columns-solved-miss$suffix", columns, listOf("landlord", "caução", "proprietário", "rent", "aluguel") + all.drop(4))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = states("", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = states("-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        start(dark = false)
        show("activity-midway-font200", activity, listOf(left("a"), right("a")))
        show("columns-midway-font200", columns, listOf("rent", "aluguel"))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi-qwerty")
    fun phoneWithAKeyboard() {
        start(dark = false)
        show("columns-untouched-keys", columns, emptyList())
        show("columns-midway-keys", columns, listOf("rent", "aluguel"))
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() {
        start(dark = false)
        show("activity-midway-tablet", activity, listOf(left("a"), right("a"), left("b"), right("b")))
        show(
            "activity-solved-tablet",
            activity,
            listOf(left("a"), right("b"), right("a"), left("b"), right("b"), left("c"), right("c"), left("d"), right("d")),
            check = true,
        )
    }

    private companion object {
        const val FRAME = 16L
        const val CUE = 700L
    }
}
