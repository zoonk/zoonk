package com.zoonk.android.feature.catalog

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
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

/**
 * Review screenshots of the catalog's pages, written only on demand:
 * `./gradlew :feature:catalog:testDebugUnitTest --tests '*CatalogScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CatalogScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phone() = captureAll("phone")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = captureAll("phone-dark-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h4000dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureAll("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h2000dp-xhdpi")
    fun tablet() = captureAll("tablet")

    @Test
    @Config(qualifiers = "w1280dp-h2000dp-night-xhdpi")
    fun tabletDark() = captureAll("tablet-dark", dark = true)

    /** A Pixel Fold unfolded flat: the page beside the 80dp navigation rail, the fold down the window's middle. */
    @Test
    @Config(qualifiers = "w852dp-h1800dp-xhdpi")
    fun openBook() = captureAll("open-book", page = 772.dp, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h1800dp-night-xhdpi")
    fun openBookDark() = captureAll("open-book-dark", dark = true, page = 772.dp, fold = true)

    private fun captureAll(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        page: Dp = Dp.Unspecified,
        fold: Boolean = false,
    ) {
        val screens: List<Pair<String, @Composable (AppContainer, AppNavigator, CatalogStore) -> Unit>> =
            listOf(
                "catalog" to { app, navigator, store -> CatalogScreen(AppRoute.Catalog(), app, navigator, store) },
                "course" to { app, navigator, store -> CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, store) },
                "chapter" to {
                    app,
                    navigator,
                    store,
                    ->
                    ChapterScreen(AppRoute.CatalogChapter(CHAPTER_TWO, COURSE), app, navigator, store)
                },
                "lesson" to
                    {
                        app,
                        navigator,
                        store,
                        ->
                        LessonScreen(AppRoute.CatalogLesson(LESSON_TWO, CHAPTER_ONE, COURSE), app, navigator, store)
                    },
            )
        var shown by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    val context = LocalContext.current
                    val app = remember { AppContainer.preview(context) }
                    val store =
                        remember {
                            CatalogStore(
                                FakeCatalogApi(),
                                AppCache(
                                    FakeSession(null),
                                    CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                                ),
                            )
                        }
                    val navigator = rememberAppNavigator()
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                        Box(if (page == Dp.Unspecified) Modifier.fillMaxSize() else Modifier.width(page)) {
                            screens[shown].second(app, navigator, store)
                        }
                    }
                }
            }
        }

        if (fold) compose.unfoldBook(folds)
        screens.forEachIndexed { index, (name) ->
            shown = index
            compose.waitForIdle()
            write("$prefix-$name", compose.onRoot().captureRender().asAndroidBitmap())
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
