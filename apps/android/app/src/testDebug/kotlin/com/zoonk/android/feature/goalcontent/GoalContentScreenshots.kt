package com.zoonk.android.feature.goalcontent

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.mindmaps.MindMapCardActions
import com.zoonk.android.feature.mindmaps.MindMapCardContent
import com.zoonk.android.feature.mindmaps.MindMapShown
import com.zoonk.android.feature.mindmaps.chapterMindMap
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.GoalChapter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.datetime.TimeZone
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
 * Review screenshots of the subject and chapter pages and the Plan's structure, written only on
 * demand: `./gradlew :app:testDebugUnitTest --tests '*GoalContentScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GoalContentScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h5200dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h2000dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h1600dp-land-xhdpi")
    fun expanded() = capture("expanded")

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { key(index) { SCREENS[index].second() } }
            }
        }
        SCREENS.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            val shot = SCREENS[screen].first
            write("$shot-$name", compose.onRoot().captureToImage().asAndroidBitmap())
            val opens = OPENED[shot] ?: return@forEach
            opens.forEach { compose.onNodeWithText(it).performClick() }
            compose.waitForIdle()
            write("$shot-opened-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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

    private companion object {
        val TODAY: LocalDate = LocalDate.of(2026, 10, 28)
        val NO_ACTIONS = SubjectActions(back = {}, openChapter = {}, adjustPlan = {}, restore = {}, setCadence = {}, openMindMaps = {})

        /** What each screen's opened shot taps first. */
        val OPENED =
            mapOf(
                "subject-exam" to listOf("1 chapter done, 1 skipped because you already know it", "1 Mechanics"),
                "chapter" to listOf("Chapter summary"),
            )

        val MISSING_CHAPTER =
            object : GoalContentApi {
                override suspend fun chapter(
                    session: AuthenticatedSession,
                    key: ChapterKey,
                ): GoalChapter = throw ApiException(ApiError.NotFound)

                override suspend fun practiceArea(
                    session: AuthenticatedSession,
                    goalId: UUID,
                    input: AreaPracticeInput,
                ): AreaPractice = throw ApiException(ApiError.NotFound)
            }

        /** The page's own tools, as the screens add them: Ask the buddy and Report a problem. */
        @Composable
        fun tools(scope: TutorScope): Pair<@Composable () -> Unit, @Composable (AskTutorAppearance) -> Unit> {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val navigator = rememberAppNavigator()
            return Pair(
                { ReportProblemMenu(app, FeedbackTarget(screen = "screenshots")) },
                { AskTutor(scope, app, navigator, appearance = it) },
            )
        }

        @Composable
        fun Subject(key: String) {
            val syllabus = if (key == "basics") modulesSyllabus() else examSyllabus()
            val (menu, ask) = tools(TutorScope.Subject(GOAL, key))
            SubjectPage(syllabus, syllabus.subjects.first { it.key == key }, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
        }

        @Composable
        fun Chapter() {
            val (menu, ask) = tools(TutorScope.Chapter(chapterId(3)))
            val context = LocalContext.current
            val pictures =
                remember { PrivatePictures(AppContainer.preview(context).images, AuthenticatedSession("ana", "token-a", "local-a")) }
            val map = chapterMindMap("ready")
            val navigator = rememberAppNavigator()
            val card =
                MindMapSlot(map) { MindMapCardContent(map, MindMapShown.Ready, null, null, MindMapCardActions({}, {}, {}, {}), navigator) }
            CompositionLocalProvider(LocalPrivatePictures provides pictures) {
                ChapterPage(
                    goalChapter(),
                    PracticeState(outcome = PracticeOutcome.DailyCap),
                    ChapterActions({}, {}, {}, {}),
                    menu,
                    ask,
                    card,
                )
            }
        }

        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "subject-exam" to { Subject("natural-sciences") },
                "subject-skipped" to { Subject("spanish") },
                "subject-written" to { Subject("essay") },
                "subject-module" to { Subject("basics") },
                "chapter" to { Chapter() },
                "chapter-not-found" to {
                    val store =
                        remember {
                            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                            val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
                            GoalContentStore(MISSING_CHAPTER, cache, timeZone = { TimeZone.UTC })
                        }
                    ChapterContent(ChapterKey(UUID.fromString(GOAL), UUID.fromString(chapterId(3))), store, rememberAppNavigator())
                },
                "plan-section-exam" to {
                    PlanSyllabusSection(examSyllabus(), {}, Modifier.verticalScroll(rememberScrollState()).padding(vertical = 16.dp))
                },
                "plan-section-modules" to { PlanSyllabusSection(modulesSyllabus(), {}, Modifier.padding(vertical = 16.dp)) },
            )
    }
}
