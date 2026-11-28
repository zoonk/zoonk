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
import com.zoonk.android.feature.mindmaps.MindMapPlace
import com.zoonk.android.feature.mindmaps.MindMapRow
import com.zoonk.android.feature.mindmaps.MindMapRowActions
import com.zoonk.android.feature.mindmaps.MindMapShown
import com.zoonk.android.feature.mindmaps.chapterMindMap
import com.zoonk.android.feature.mindmaps.facts
import com.zoonk.android.feature.plan.plan
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.StudyBlockWritingAvailabilityOneOf
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.WritingTask
import com.zoonk.api.models.WrittenPracticeSubjectsInner
import com.zoonk.api.models.WrittenPracticeSubjectsInnerAnswersInnerCriteria
import com.zoonk.api.models.WrittenPracticeSubjectsInnerWriteActionsInner
import com.zoonk.api.models.WrittenPracticeSubjectsInnerWriteActionsInnerAvailability
import com.zoonk.api.models.WrittenPracticeSubjectsInnerWriteActionsInnerAvailabilityOneOf
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
 * demand: `./gradlew :feature:plan:testDebugUnitTest --tests '*GoalContentScreenshots*' --rerun -Pzoonk.shots=<folder>`.
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
    @Config(qualifiers = "pt-w411dp-h2600dp-xxhdpi")
    fun phoneInPortuguese() = capture("phone-pt", opens = false)

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

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun partlyPlannedModulePhone() = capture("phone", screens = SCREENS.filter { it.first == "subject-module-partly-left-out" })

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        opens: Boolean = true,
        screens: List<Pair<String, @Composable () -> Unit>> = SCREENS,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { key(index) { screens[index].second() } }
            }
        }
        screens.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            val shot = screens[screen].first
            write("$shot-$name", compose.onRoot().captureRender().asAndroidBitmap())
            // The taps find English words.
            val taps = OPENED[shot]?.takeIf { opens } ?: return@forEach
            taps.forEach { compose.onNodeWithText(it).performClick() }
            compose.waitForIdle()
            write("$shot-opened-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
        println("Screenshot ${file.path}")
    }

    private companion object {
        val TODAY: LocalDate = LocalDate.of(2026, 10, 28)
        val NO_ACTIONS =
            SubjectActions(
                back = {},
                openChapter = {},
                adjustPlan = {},
                restore = {},
                setCadence = {},
                openMindMaps = {},
                writeNow = WriteNow(busy = false, failed = false) {},
            )

        /** What each screen's opened shot taps first. */
        val OPENED =
            mapOf(
                "subject-exam" to listOf("1 chapter done, 1 you already know", "1. Mechanics"),
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
            val (menu, ask) = tools(TutorScope.Subject(GOAL, key, module = !syllabus.isExam))
            SubjectPage(syllabus, syllabus.subjects.first { it.key == key }, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
        }

        /** A subject left out for time, as core sends one: no lessons in the plan, so no chapters and no next date. */
        fun leftOutForTime(subject: SyllabusSubject): SyllabusSubject =
            subject.copy(notPlannedReason = "time", chapters = emptyList(), lessonsDone = 0, lessonsTotal = 0, nextDate = null)

        /** The Python plan with its Data module out for [reason], as core sends a module the plan doesn't teach: its skills, no lessons. */
        fun modulesWithDataOut(reason: String): Syllabus {
            val syllabus = modulesSyllabus()
            val skills = listOf("Lists and tuples", "Dictionaries and sets", "Reading and writing CSV files", "Cleaning messy data")
            return syllabus.copy(
                subjects =
                    syllabus.subjects.map {
                        if (it.key == "data") {
                            it.copy(notPlannedReason = reason, chapters = emptyList(), covers = skills, lessonsTotal = 0, nextDate = null)
                        } else {
                            it
                        }
                    },
            )
        }

        @Composable
        fun ModuleOut(reason: String) {
            val syllabus = modulesWithDataOut(reason)
            val (menu, ask) = tools(TutorScope.Subject(GOAL, "data", module = true))
            SubjectPage(syllabus, syllabus.subjects.first { it.key == "data" }, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
        }

        /** The written subject as [edit] changes it: graded by level, or waiting for an exam choice. */
        @Composable
        fun WrittenSubject(edit: (WrittenPracticeSubjectsInner) -> WrittenPracticeSubjectsInner) {
            val exam = examSyllabus()
            val practice = checkNotNull(exam.writtenPractice)
            val syllabus = exam.copy(writtenPractice = practice.copy(subjects = practice.subjects?.map(edit)))
            val (menu, ask) = tools(TutorScope.Subject(GOAL, "essay", module = false))
            SubjectPage(syllabus, syllabus.subjects.first { it.key == "essay" }, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
        }

        private fun gradedByLevel(written: WrittenPracticeSubjectsInner) =
            written.copy(
                scale = WrittenPracticeSubjectsInner.Scale.LEVELS,
                points = written.points.copy(range = null, standing = null, tasks = written.points.tasks.map { it.copy(range = null) }),
                answers =
                    written.answers.map {
                        it.copy(range = null, criteria = WrittenPracticeSubjectsInnerAnswersInnerCriteria(complete = 1L, total = 4L))
                    },
            )

        /** Estimated in points, before the first answer. */
        private fun notMeasured(written: WrittenPracticeSubjectsInner) =
            gradedByLevel(written).copy(scale = WrittenPracticeSubjectsInner.Scale.POINTS, answers = emptyList(), trend = emptyList())

        private fun waitingForAChoice(written: WrittenPracticeSubjectsInner) =
            gradedByLevel(written).copy(
                writeActions =
                    listOf(
                        WrittenPracticeSubjectsInnerWriteActionsInner(
                            WrittenPracticeSubjectsInnerWriteActionsInnerAvailability.StudyBlockWritingAvailabilityOneOfValue(
                                StudyBlockWritingAvailabilityOneOf(StudyBlockWritingAvailabilityOneOf.Status.AVAILABLE),
                            ),
                            taskKey = "short",
                        ),
                        WrittenPracticeSubjectsInnerWriteActionsInner(
                            WrittenPracticeSubjectsInnerWriteActionsInnerAvailability
                                .WrittenPracticeSubjectsInnerWriteActionsInnerAvailabilityOneOfValue(
                                    WrittenPracticeSubjectsInnerWriteActionsInnerAvailabilityOneOf(
                                        listOf("Specialty"),
                                        WrittenPracticeSubjectsInnerWriteActionsInnerAvailabilityOneOf.Status.NEEDS_CHOICE,
                                    ),
                                ),
                            taskKey = "long",
                            writingTask = WritingTask(lines = 60L, points = 70.0, distinctLines = true, number = 2L, total = 2L),
                        ),
                    ),
            )

        @Composable
        fun Chapter() {
            val (menu, ask) = tools(TutorScope.Chapter(chapterId(3)))
            val context = LocalContext.current
            val pictures =
                remember { PrivatePictures(AppContainer.preview(context).images, AuthenticatedSession("ana", "token-a", "local-a")) }
            val map = chapterMindMap("ready").facts
            CompositionLocalProvider(LocalPrivatePictures provides pictures) {
                ChapterPage(
                    goalChapter(),
                    PracticeState(outcome = PracticeOutcome.Failed),
                    ChapterActions({}, {}, {}, {}),
                    menu,
                    ask,
                    ChapterMapSlot(shown = true) { modifier ->
                        MindMapRow(
                            map,
                            MindMapPlace.Chapter,
                            MindMapShown.Ready,
                            null,
                            null,
                            plus = false,
                            MindMapRowActions({}, {}, {}),
                            modifier,
                        )
                    },
                )
            }
        }

        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "calls-known-phase" to {
                    val syllabus = examSyllabus()
                    PlanSyllabusSection(syllabus.copy(subjects = listOf(syllabus.subjects.first().copy(notPlannedReason = "known"))), {})
                },
                "calls-topic-reasons" to {
                    val syllabus = examSyllabus()
                    val subject = syllabus.subjects.first { it.topics.isNotEmpty() }
                    val topics =
                        listOf("pastBasics", "skippedBase", "skipped", "time", "missing", "known").map { reason ->
                            subject.topics.first().copy(
                                name = reason,
                                status = com.zoonk.api.models.SyllabusTopic.Status.NOT_PLANNED,
                                notPlannedReason = reason,
                                chapters = emptyList(),
                            )
                        }
                    SubjectPage(syllabus, subject.copy(topics = topics), SubjectWrites(), NO_ACTIONS, TODAY, {}, {})
                },
                "subject-exam" to { Subject("natural-sciences") },
                "subject-skipped" to { Subject("spanish") },
                "subject-left-out-for-time" to {
                    val syllabus = examSyllabus()
                    val subject = leftOutForTime(syllabus.subjects.first())
                    SubjectPage(syllabus, subject, SubjectWrites(), NO_ACTIONS, TODAY, {}, {})
                },
                "subject-written" to { Subject("essay") },
                "subject-written-left-out-for-time" to {
                    val syllabus = examSyllabus()
                    val essay = leftOutForTime(syllabus.subjects.first { it.key == "essay" })
                    val (menu, ask) = tools(TutorScope.Subject(GOAL, "essay", module = false))
                    SubjectPage(syllabus, essay, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
                },
                "subject-module-taken-out" to { ModuleOut("skipped") },
                "subject-module-left-out-for-time" to { ModuleOut("time") },
                "plan-section-module-taken-out" to
                    { PlanSyllabusSection(modulesWithDataOut("skipped"), {}, Modifier.padding(vertical = 16.dp)) },
                "reveal-module-taken-out" to { RevealStructure(plan(), modulesWithDataOut("skipped"), Modifier.padding(16.dp)) },
                "subject-module-partly-left-out" to {
                    val syllabus = modulesWithTopicsLeftOut()
                    val (menu, ask) = tools(TutorScope.Subject(GOAL, "data", module = true))
                    SubjectPage(syllabus, syllabus.subjects.first { it.key == "data" }, SubjectWrites(), NO_ACTIONS, TODAY, menu, ask)
                },
                "subject-written-levels" to { WrittenSubject(::gradedByLevel) },
                "subject-written-unmeasured" to { WrittenSubject(::notMeasured) },
                "subject-written-needs-choice" to { WrittenSubject(::waitingForAChoice) },
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
