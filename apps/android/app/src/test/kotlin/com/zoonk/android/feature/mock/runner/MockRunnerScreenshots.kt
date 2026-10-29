package com.zoonk.android.feature.mock.runner

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
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
    @get:Rule
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
    fun theBreak() =
        capture(
            "mock-break",
            runningMock(
                current = "null",
                extra = """"breakUntil":"${Clock.System.now() + 9.minutes}"""",
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun handedIn() = capture("mock-handed-in", runningMock(current = "null"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun expired() = capture("mock-expired", runningMock(extra = """"status":"expired""""))

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
                Surface { MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store) }
            }
        }
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(shots, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
