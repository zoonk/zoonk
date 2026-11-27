package com.zoonk.android.feature.savedlessons

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.completedlessons.CompletedLessonsStore
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
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
import java.util.UUID

/**
 * Review screenshots of Saved lessons, written only on demand:
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*SavedLessonsScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SavedLessonsScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun lessons(gone: Boolean) =
        listOf(
            "How cells divide" to "Cell biology",
            "Why the cell membrane lets some things through and keeps others out" to "Cell biology",
            "Balancing an equation" to "Reactions",
            "Proteins and what they do" to null,
            "Photosynthesis" to "Energy in living things",
        ).mapIndexed { index, (title, chapter) ->
            savedLesson(UUID.fromString("00000000-0000-4000-8000-00000000000$index"), title, chapter)
        } +
            listOfNotNull(
                savedLesson(UUID.fromString("00000000-0000-4000-8000-000000000009"), "Thermodynamics", "Heat", available = false)
                    .takeIf { gone },
            )

    private fun show(
        name: String,
        dark: Boolean = false,
        empty: Boolean = false,
        gone: Boolean = false,
        removeSecond: Boolean = false,
        fold: Boolean = false,
    ) {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api = FakeSavedLessonsApi(if (empty) emptyList() else lessons(gone))
        val store = SavedLessonsStore(api, cache, CompletedLessonsStore({ _, _, _, _ -> error("not read") }, cache, session))
        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    PageScaffold(onBack = {}, title = { Text("Saved lessons") }) { padding ->
                        Box(Modifier.fillMaxSize().padding(padding)) { SavedLessons(goalId, store, AppSnackbars()) {} }
                    }
                }
            }
        }
        if (fold) rule.unfoldBook(folds)
        if (removeSecond) {
            rule.waitForIdle()
            rule.onNodeWithContentDescription("Saved Why the cell membrane lets some things through and keeps others out").performClick()
        }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        writeRender(File(folder, "saved-lessons-$name.png"), bitmap)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = show("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = show("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRemoved() = show("phone-removed", removeSecond = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneRemovedDark() = show("phone-removed-dark", dark = true, removeSecond = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNoLongerAvailable() = show("phone-gone", gone = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneEmpty() = show("phone-empty", empty = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200", gone = true)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = show("tablet", gone = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun foldUnfolded() = show("fold", gone = true, fold = true)
}
