package com.zoonk.android.feature.mock.runner

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.result.SPEAKING
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.theme.ZoonkTheme
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
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes

/** Review screenshots of the mock runner, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MockRunnerScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val shots = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", shots.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("mock-phone", answered())

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("mock-phone-dark-more-contrast", answered(), dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("mock-phone-font200", answered())
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = capture("mock-expanded", answered())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun timeUp() = capture("mock-time-up", runningMock(current = currentSection(deadline = "${Clock.System.now() - 1.minutes}")))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun theBreak() = capture("mock-break", onBreak())

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun theBreakBesideItsSections() = capture("mock-break-expanded", onBreak())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun handedIn() = capture("mock-handed-in", runningMock(current = "null"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun expired() = capture("mock-expired", expiredMock())

    /** Where a wrong statement cancels a right one, the keys say ✓, ✗ and –. */
    @Test
    fun netScoredStatements() =
        capture(
            "mock-net-statements",
            runningMock(
                current =
                    currentSection(
                        questions = question(ITEM_ONE, 1, "Water boils at 100 °C at sea level.", emptyList(), "trueFalse"),
                    ),
                extra = """"scoring":"net"""",
            ),
        )

    @Test
    @Config(qualifiers = BOOK)
    fun bookQuestion() = capture("mock-book-question", answered(), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyQuestion() = capture("mock-galaxy-question", answered(), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookTimeUp() = capture("mock-book-time-up", timedOut(), unfolded = true, shows = TIME_UP)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyTimeUp() = capture("mock-galaxy-time-up", timedOut(), unfolded = true, shows = TIME_UP)

    @Test
    @Config(qualifiers = BOOK)
    fun bookHandedIn() = capture("mock-book-handed-in", runningMock(current = "null"), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyHandedIn() = capture("mock-galaxy-handed-in", runningMock(current = "null"), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookExpired() = capture("mock-book-expired", expiredMock(), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyExpired() = capture("mock-galaxy-expired", expiredMock(), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookBreakOneSection() = capture("mock-book-break-one-section", onBreakBeforeOneSection(), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyBreakOneSection() = capture("mock-galaxy-break-one-section", onBreakBeforeOneSection(), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookBreakBesideItsSections() = capture("mock-book-break-sections", onBreak(), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookSpeakingIntro() = capture("mock-book-speaking-intro", speakingSection(paper = "null"), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxySpeakingIntro() = capture("mock-galaxy-speaking-intro", speakingSection(paper = "null"), unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookSpeakingTasks() = capture("mock-book-speaking-tasks", speakingSection(), unfolded = true)

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxySpeakingTasks() = capture("mock-galaxy-speaking-tasks", speakingSection(), unfolded = true)

    @Test
    @Config(qualifiers = BOOK_NIGHT)
    fun bookExpiredDarkMoreContrast() =
        capture("mock-book-expired-dark-more-contrast", expiredMock(), dark = true, moreContrast = true, unfolded = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookExpiredAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("mock-book-expired-font200", expiredMock(), unfolded = true)
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookExpiredRightToLeft() = capture("mock-book-expired-rtl", expiredMock(), unfolded = true, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = MEDIUM)
    fun mediumExpired() = capture("mock-medium-expired", expiredMock())

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expandedExpired() = capture("mock-expanded-expired", expiredMock())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneSpeakingTasks() = capture("mock-phone-speaking-tasks", speakingSection())

    @Test
    @Config(qualifiers = MEDIUM)
    fun mediumSpeakingTasks() = capture("mock-medium-speaking-tasks", speakingSection())

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expandedSpeakingTasks() = capture("mock-expanded-speaking-tasks", speakingSection())

    @Test
    @Config(qualifiers = BOOK)
    fun bookSpeakingTasksAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("mock-book-speaking-tasks-font200", speakingSection(), unfolded = true)
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookSpeakingTasksRightToLeft() =
        capture("mock-book-speaking-tasks-rtl", speakingSection(), unfolded = true, layoutDirection = LayoutDirection.Rtl)

    private fun expiredMock() = runningMock(extra = """"status":"expired"""")

    private fun timedOut() = runningMock(current = currentSection(deadline = "${Clock.System.now() - 1.minutes}"))

    /** A break after the first section, the last one ahead: no sections aside. */
    private fun onBreakBeforeOneSection() =
        runningMock(
            current = "null",
            extra =
                """"breakUntil":"${Clock.System.now() + 9.minutes}",
                "sections":[{"breakAfterMinutes":null,"essays":0,"index":0,"minutes":30,"name":"Languages","navigation":null,"questions":1,"status":"current","tools":"Pen and paper"}]""",
        )

    /** A speaking section, its second task still to do; with [paper] `null`, before it starts. */
    private fun speakingSection(paper: String = SPEAKING.replaceFirst("\"completed\"}]}", "\"ready\"}]}")) =
        runningMock(
            current = currentSection(questions = "", kind = "\"speaking\""),
            extra = """"speaking":$paper""",
        )

    private fun onBreak() = runningMock(current = "null", extra = """"breakUntil":"${Clock.System.now() + 9.minutes}"""")

    /** The first question answered and the second flagged, from the drafts the server kept. */
    private fun answered() =
        runningMock(
            current =
                currentSection(
                    drafts =
                        """{"answer":{"selectedIndex":0},"durationMs":4000,"flagged":false,"itemId":"$ITEM_ONE"},
                        {"answer":null,"durationMs":2000,"flagged":true,"itemId":"$ITEM_TWO"}""",
                ),
        )

    private fun capture(
        name: String,
        mock: com.zoonk.api.models.MockExam,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        unfolded: Boolean = false,
        layoutDirection: LayoutDirection = LayoutDirection.Ltr,
        shows: String? = null,
    ) {
        val api = FakeMockRunApi(mock)
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate) }
            val store =
                remember {
                    MockRunStore(
                        api,
                        AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
                        DraftStore(folder.root, scope),
                    ) {
                        "UTC"
                    }
                }
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                    Surface { MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store) }
                }
            }
        }
        compose.waitForIdle()
        // A fold published before the screen it waits for appears never reaches that screen.
        shows?.let { text -> compose.waitUntil { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() } }
        if (unfolded) compose.unfoldBook(folds)
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(shots, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val BOOK = "w852dp-h883dp-xhdpi"
        const val GALAXY = "w707dp-h823dp-xhdpi"
        const val BOOK_NIGHT = "w852dp-h883dp-night-xhdpi"
        const val MEDIUM = "w700dp-h840dp-xhdpi"
        const val TIME_UP = "Time's up"
    }
}
