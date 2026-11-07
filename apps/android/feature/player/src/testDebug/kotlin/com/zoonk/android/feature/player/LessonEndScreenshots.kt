package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LibraryLessonCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import kotlin.time.Instant

/**
 * Review screenshots of a lesson's end, signed in, in a session and as a guest, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*LessonEndScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonEndScreenshots {
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
    @Config(qualifiers = BOOK)
    fun bookSignedIn() = capture("lessonend-signed-in-book", SIGNED_IN, LessonEnding(nextLessonId = NEXT_LESSON), fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookInSession() = capture("lessonend-session-book", IN_SESSION, LessonEnding(inSession = true), fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookGuest() = capture("lessonend-guest-book", SIGNED_IN, LessonEnding(guest = true, fit = FIT), fold = true)

    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun bookSignedInAtTwiceTheFontSize() =
        capture("lessonend-signed-in-book-font200", SIGNED_IN, LessonEnding(nextLessonId = NEXT_LESSON), fold = true)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneSignedIn() = capture("lessonend-signed-in-phone", SIGNED_IN, LessonEnding(nextLessonId = NEXT_LESSON))

    @Test
    @Config(qualifiers = PHONE)
    fun phoneGuest() = capture("lessonend-guest-phone", SIGNED_IN, LessonEnding(guest = true, fit = FIT))

    @Test
    @Config(qualifiers = TABLET)
    fun tabletSignedIn() = capture("lessonend-signed-in-tablet", SIGNED_IN, LessonEnding(nextLessonId = NEXT_LESSON))

    @Test
    @Config(qualifiers = TABLET)
    fun tabletGuest() = capture("lessonend-guest-tablet", SIGNED_IN, LessonEnding(guest = true, fit = FIT))

    private val steps = listOf(checkStep("quiz"), summaryStep("end"))

    private fun completed(json: String): LessonPlayerState {
        val started =
            reduce(
                LessonPlayerState.initial(LESSON_ID, steps, now = 0),
                LessonAction.RunStarted(RUN_ID, emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-10-28T10:00:00Z")),
                0,
            )
        return listOf(
            LessonAction.SelectAnswer("quiz", LessonAnswer.Check("right")),
            LessonAction.CheckResolved("quiz", checkResult(true).toStepResult("Right"), counts = true),
            LessonAction.Continue,
            LessonAction.Continue,
            LessonAction.CompletionSaved(ApiJson.decodeFromString(LibraryLessonCompletion.serializer(), json)),
        ).fold(started) { state, action -> reduce(state, action, 0) }
    }

    private fun capture(
        name: String,
        json: String,
        ending: LessonEnding,
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
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }

        compose.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    LessonPlayer(
                        playable(steps),
                        completed(json),
                        ending,
                        viewModel,
                        exits,
                        rememberAppNavigator(),
                        tutor = LessonTutor(TutorIdentity("Sam", look = null)) { _, _, _, _, _, _ -> },
                    )
                }
            }
        }
        if (fold) compose.unfoldBook(folds) else compose.waitForIdle()
        compose.mainClock.advanceTimeBy(10_000)
        compose.waitForIdle()
        write(name, compose.onRoot().captureRender().asAndroidBitmap())
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

private const val BOOK = "w852dp-h883dp-xhdpi"
private const val PHONE = "w411dp-h891dp-xxhdpi"
private const val TABLET = "w1280dp-h800dp-land-xhdpi"
private const val NEXT_LESSON = "00000000-0000-4000-8000-000000000099"

private val SIGNED_IN =
    COMPLETION.replace(
        """"reached":{"energy":null,"level":null}""",
        """"reached":{"energy":80,"level":{"color":"yellow","level":3}}""",
    )

private val IN_SESSION =
    SIGNED_IN.replace(
        """"studyBlock":null""",
        """
        "studyBlock":{"blockId":"2b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","brainPower":50,"capsulesOpened":0,"ceremony":null,"certificates":[],
         "checkpoint":null,"comesBackOn":null,"completedMissions":["somethingNew"],"correct":2,"fullMeal":{"bonus":20,"paid":true},
         "milestones":[],"missions":[{"done":1,"kind":"somethingNew","status":"done","total":1},{"done":0,"kind":"review","status":"todo","total":1}],
         "netScore":null,"nextBlockId":null,"reached":{"energy":80,"level":{"color":"yellow","level":3}},
         "reminderOffer":null,"sessionBar":{"completed":1,"total":3},"sessionCompleted":false,"testOutOffer":null,"topHyperdrive":0,"total":3}
        """.trimIndent(),
    )

private val FIT: LessonFit =
    ApiJson.decodeFromString(
        LessonFit.serializer(),
        """
        {"chapter":{"id":"00000000-0000-4000-8000-000000000031","lessonCount":6,"lessonNumber":2,"title":"How clouds form"},
         "course":{"chapterCount":8,"id":"00000000-0000-4000-8000-000000000032","minutes":240,"startChapterId":null,"title":"Weather, from the ground up"}}
        """.trimIndent(),
    )
