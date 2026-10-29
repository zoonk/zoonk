package com.zoonk.android.feature.mock.chooser

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.StepState
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.feature.exam.mockOptions
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the mock chooser, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MockChooserScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phone() = capture("chooser-phone")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("chooser-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2800dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("chooser-phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phoneShort() {
        starts.starts = listOf { short() }
        capture("chooser-phone-short") { compose.onNodeWithText("Start").performClick() }
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phoneWithoutPlus() = capture("chooser-phone-free", options = """$OPTIONS,"access":"plusRequired"""")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("chooser-expanded")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-night-xhdpi")
    fun expandedDark() = capture("chooser-expanded-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1200dp-xxhdpi")
    fun placementPhone() = capture("placement-phone", placement = true, options = PLACEMENT)

    @Test
    @Config(qualifiers = "w411dp-h1200dp-xxhdpi")
    fun placementWithoutPlus() = capture("placement-phone-free", placement = true, options = """$PLACEMENT,"access":"plusRequired"""")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun placementExpanded() = capture("placement-expanded", placement = true, options = PLACEMENT)

    @Test
    @Config(qualifiers = "w411dp-h1000dp-xxhdpi")
    fun writing() {
        compose.mainClock.autoAdvance = false
        compose.setContent {
            ZoonkTheme {
                Surface {
                    MockWriting(
                        run =
                            GenerationRun(
                                status = GenerationRun.Status.Following,
                                steps = mapOf("writeMockQuestions" to StepState.Started),
                            ),
                        onRetry = {},
                    )
                }
            }
        }
        compose.mainClock.advanceTimeBy(WRITING_FOR)
        write("chooser-writing", compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private val starts = FakeMockStartApi()

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        placement: Boolean = false,
        options: String = OPTIONS,
        act: () -> Unit = {},
    ) {
        val mocks = FakeMockApi(mockOptions(options))
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val cache =
                remember {
                    AppCache(
                        FakeSession(AuthenticatedSession("ana", "token", "local")),
                        CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                    )
                }
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    MockChooser(
                        goalId = GOAL,
                        placement = placement,
                        app = app,
                        navigator = rememberAppNavigator(),
                        mockStore = remember { MockStore(mocks, cache) },
                        starter = remember { MockStarter(starts, cache) },
                        generations = { ReadyRuns() },
                    )
                }
            }
        }
        compose.waitForIdle()
        act()
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val WRITING_FOR = 4_000L

        val OPTIONS =
            """
            "examName":"ENEM",
            "options":[{"area":null,"day":1,"kind":"full","areas":["Languages","Human Sciences"],"covers":null,"estimatedMinutes":300,"leftOut":[],
              "minutes":330,"objectiveOnly":false,"questions":90,"written":["Essay"]},
             {"area":null,"day":1,"kind":"half","areas":["Languages"],"covers":null,"estimatedMinutes":140,"leftOut":[],
              "minutes":165,"objectiveOnly":true,"questions":45,"written":[]},
             {"area":null,"day":2,"kind":"full","areas":["Mathematics","Natural Sciences"],"covers":null,"estimatedMinutes":280,"leftOut":[],
              "minutes":300,"objectiveOnly":false,"questions":90,"written":[]},
             {"area":"Mathematics","day":null,"kind":"area","areas":["Mathematics"],"covers":null,"estimatedMinutes":120,
              "leftOut":[{"name":null,"part":"numeric"}],"minutes":135,"objectiveOnly":false,"questions":45,"written":[]},
             {"area":"Languages","day":null,"kind":"area","areas":["Languages"],"covers":null,"estimatedMinutes":110,"leftOut":[],
              "minutes":135,"objectiveOnly":false,"questions":45,"written":[]}],
            "lastMock":{"blockId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03","correct":52,"examQuestions":180,"finishedAt":"2026-10-20T15:00:00Z",
             "measure":52,"number":2,"purpose":"practice","scoring":"raw","shape":{"area":null,"day":1,"kind":"full"},"total":90},
            "sizeSource":{"formats":null,"material":false,"pastEdition":{"edition":"2024 exam","title":null,"url":"https://www.inep.gov.br/enem"},
             "questions":"notice","subjects":"pastEdition","time":"unstated"}
            """.trimIndent()

        val PLACEMENT =
            """
            "examName":"ENEM",
            "placement":{"mock":null,"recommended":"medium","options":[
             {"areas":["Mathematics","Languages"],"coversAllAreas":false,"estimatedMinutes":15,"length":"short","minutes":20,"questions":12},
             {"areas":["Languages","Human Sciences","Mathematics","Natural Sciences"],"coversAllAreas":true,"estimatedMinutes":30,"length":"medium","minutes":40,"questions":24},
             {"areas":["Languages","Human Sciences","Mathematics","Natural Sciences"],"coversAllAreas":true,"estimatedMinutes":60,"length":"long","minutes":80,"questions":48}]}
            """.trimIndent()
    }
}
