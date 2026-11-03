package com.zoonk.android.feature.completedlessons

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLessonList
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
import java.time.LocalDate
import java.util.UUID

/**
 * Review screenshots of Completed lessons, written only on demand:
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*CompletedLessonsScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CompletedLessonsScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun list(empty: Boolean): CompletedLessonList {
        val today = LocalDate.now()
        val lessons =
            listOf(
                Triple("How cells divide", "Cell biology", today),
                Triple("Mitosis step by step", "Cell biology", today),
                Triple("What a gene is", "Genetics", today.minusDays(1)),
                Triple("Proteins and what they do", null, today.minusDays(3)),
                Triple("Why the cell membrane lets some things through and keeps others out", "Cell biology", today.minusDays(3)),
                Triple("Photosynthesis", "Energy in living things", today.minusDays(9)),
                Triple("Respiration", "Energy in living things", today.minusYears(1)),
            ).takeUnless { empty }.orEmpty()
        val data =
            lessons.mapIndexed { index, (title, chapter, day) ->
                """{"chapterTitle":${chapter?.let { "\"$it\"" } ?: "null"},"finishedOn":"$day",
                "lessonId":"00000000-0000-4000-8000-00000000000$index","title":"$title"}"""
            }
        return ApiJson.decodeFromString(
            CompletedLessonList.serializer(),
            """{"data":[${data.joinToString(",")}],"pagination":{"hasMore":false,"nextCursor":null}}""",
        )
    }

    private fun show(
        name: String,
        dark: Boolean = false,
        empty: Boolean = false,
        fold: Boolean = false,
    ) {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val store =
            CompletedLessonsStore(
                { _, _, _ -> list(empty) },
                AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                session,
            )
        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    PageScaffold(onBack = {}) { padding ->
                        Box(
                            Modifier.fillMaxSize().padding(padding),
                        ) { CompletedLessons(goalId, LocalDate.now(), store, rememberLazyListState()) {} }
                    }
                }
            }
        }
        if (fold) {
            rule.waitForIdle()
            folds.overrideWindowLayoutInfo(
                TestWindowLayoutInfo(
                    listOf(
                        FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL),
                    ),
                ),
            )
        }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "completed-lessons-$name.png").apply { parentFile?.mkdirs() }.outputStream().use {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = show("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = show("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneEmpty() = show("phone-empty", empty = true)

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = show("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = show("tablet")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun foldUnfolded() = show("fold", fold = true)
}
