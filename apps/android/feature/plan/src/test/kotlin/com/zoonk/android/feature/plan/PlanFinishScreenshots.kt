package com.zoonk.android.feature.plan

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.languageAimOf
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageAim
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFinishPrecision
import com.zoonk.api.models.PlanFinishReason
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseCheckpoint
import kotlinx.datetime.LocalDate
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** When an undated plan finishes, on the Plan's path and in Adjust plan, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PlanFinishScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1900dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1900dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h3400dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() =
        capture("expanded", pages = listOf("year" to yearPage(), "beyond" to beyondPage(), "one-phase" to onePhasePage()), editor = false)

    @Test
    @Config(qualifiers = "w411dp-h1200dp-xxhdpi")
    fun phaseSheet() = sheets("phone")

    @Test
    @Config(qualifiers = "w411dp-h1200dp-night-xxhdpi")
    fun phaseSheetDark() = sheets("phone-dark", dark = true)

    /** A phase years off, one with no place yet and its challenge, and an exam phase ahead and one under way ending on its challenge's day. */
    private fun sheets(
        name: String,
        dark: Boolean = false,
    ) {
        val sheets =
            listOf(
                "year" to (yearPage() to 2),
                "later" to (beyondPage() to 3),
                "exam-challenge-day" to (examChallengeDayPage() to 2),
                "exam-current-challenge-day" to (examCurrentChallengeDayPage() to 1),
            )
        var shown by mutableStateOf(sheets.first())
        compose.setContent {
            val (page, index) = shown.second
            ZoonkTheme(darkTheme = dark) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        PhaseDetails(page, page.plan.phases[index], PlanLinks(rememberAppNavigator(), page))
                    }
                }
            }
        }
        sheets.forEach {
            shown = it
            compose.waitForIdle()
            write("plan-phase-sheet-${it.first}-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    /** An exam phase ahead whose challenge falls on its last day, as both its row and the challenge's say "~". */
    private fun examChallengeDayPage(): PlanPageState = examPhaseEndingOnItsChallenge(2)

    /** The exam phase under way, months from its end on its challenge's day: both keep that day. */
    private fun examCurrentChallengeDayPage(): PlanPageState = examPhaseEndingOnItsChallenge(1)

    private fun examPhaseEndingOnItsChallenge(index: Long): PlanPageState {
        val page = examPage(year = false)
        val challenge =
            ApiJson.decodeFromString(
                PlanPhaseCheckpoint.serializer(),
                """{"date":"2027-01-20","locked":false,"planItemId":null,"precision":"month","state":"upcoming","when":"date"}""",
            )
        val plan =
            page.plan.copy(
                phases =
                    page.plan.phases.map {
                        if (it.index == index) {
                            it.copy(
                                name = "",
                                milestone = null,
                                kind = PlanPhase.Kind.GAPS,
                                endDate = LocalDate(2027, 1, 20),
                                precision = PlanFinishPrecision.MONTH,
                                checkpoint = challenge,
                            )
                        } else {
                            it
                        }
                    },
            )
        return page.copy(plan = plan)
    }

    @Test
    @Config(qualifiers = "w411dp-h1200dp-xxhdpi")
    fun changeNotices() = notices("phone")

    @Test
    @Config(qualifiers = "w411dp-h1200dp-night-xxhdpi")
    fun changeNoticesDark() = notices("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun changeNoticesAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        notices("phone-font200")
    }

    /** The end of the plan moving: by its day when both ends are near, by month, and by year once far off. */
    private fun notices(
        name: String,
        dark: Boolean = false,
    ) {
        val today = java.time.LocalDate.now()
        val moves =
            listOf(
                Triple(today.plusDays(20), today.plusDays(30), "month" to "month"),
                Triple(today.plusMonths(4), today.plusMonths(7), "month" to "month"),
                Triple(today.plusMonths(14), today.plusYears(5), "month" to "year"),
            )
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        moves.forEach { (before, after, precisions) ->
                            val fields =
                                """"endDateBefore":"$before","endDateAfter":"$after",""" +
                                    """"endPrecisionBefore":"${precisions.first}","endPrecisionAfter":"${precisions.second}""""
                            PlanEffectDiff(
                                ApiJson.decodeFromString(
                                    com.zoonk.api.models.PlanEffect
                                        .serializer(),
                                    effect(fields),
                                ),
                            )
                        }
                    }
                }
            }
        }
        compose.waitForIdle()
        write("plan-change-ends-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    @Test
    @Config(qualifiers = "w411dp-h1900dp-xxhdpi")
    fun examAfterTheExam() = capture("phone", pages = listOf("exam-month" to examPage(year = false), "exam-year" to examPage(year = true)))

    @Test
    @Config(qualifiers = "w411dp-h1900dp-night-xxhdpi")
    fun examAfterTheExamDark() =
        capture("phone-dark", dark = true, pages = listOf("exam-month" to examPage(year = false), "exam-year" to examPage(year = true)))

    /** An exam on Jan 31, 2027 whose plan keeps going after it, to a month or, at a few minutes a day, a year. */
    private fun examPage(year: Boolean): PlanPageState {
        val base = learnPlan()
        val end = if (year) LocalDate(2030, 3, 15) else LocalDate(2027, 5, 20)
        val after =
            base.phases.last().copy(
                index = base.phases.size.toLong(),
                name = "After the exam",
                kind = PlanPhase.Kind.AFTER_EXAM,
                milestone = null,
                startDate = LocalDate(2027, 2, 1),
                endDate = end,
            )
        val plan =
            base.copy(
                phases = base.phases + after,
                schedule = base.schedule.copy(targetDate = LocalDate(2027, 1, 31), fullCourse = true),
                estimate =
                    base.estimate.copy(
                        endDate = end,
                        fullCourseEndDate = end,
                        precision = if (year) PlanFinishPrecision.YEAR else PlanFinishPrecision.MONTH,
                    ),
            )
        return page(plan, kind = "exam", title = "ENEM")
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        pages: List<Pair<String, PlanPageState>> =
            listOf(
                "month" to monthPage(),
                "year" to yearPage(),
                "beyond" to beyondPage(),
                "language" to languagePage(),
                "one-phase" to onePhasePage(),
            ),
        editor: Boolean = true,
    ) {
        val shots =
            pages.flatMap { (kind, page) ->
                listOfNotNull("plan-$kind" to page to false, ("adjust-$kind" to page to true).takeIf { editor })
            }
        var shown by mutableStateOf(shots.first())
        compose.setContent {
            val (named, isEditor) = shown
            val page = named.second
            ZoonkTheme(darkTheme = dark) {
                if (isEditor) {
                    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                        Column(Modifier.padding(24.dp)) { PlanScheduleSection(page, PlanEdits(), EditorDrafts()) }
                    }
                } else {
                    Surface { Content(page) }
                }
            }
        }
        shots.forEach {
            shown = it
            compose.waitForIdle()
            write("${it.first.first}-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    @Composable
    private fun Content(page: PlanPageState) {
        PlanContent(
            page = page,
            standing = Standing.Progress(progress(), done = 13, known = 0, total = 46),
            structure = null,
            links = PlanLinks(rememberAppNavigator(), page),
            resume = Resume.Plain,
            isSaving = false,
            onSetStatus = {},
            focusTest = null,
            resumeFailure = null,
            onAdjust = {},
        )
    }

    private fun undated(
        base: Plan,
        end: LocalDate?,
        precision: PlanFinishPrecision?,
        reason: PlanFinishReason? = null,
    ) = base.copy(
        schedule = base.schedule.copy(targetDate = null),
        estimate = base.estimate.copy(endDate = end, precision = precision, finishReason = reason),
    )

    private fun Plan.phase(
        index: Int,
        milestone: String?,
        end: LocalDate?,
        precision: PlanFinishPrecision = PlanFinishPrecision.MONTH,
        start: LocalDate? = null,
    ) = copy(
        phases =
            phases.map {
                if (it.index.toInt() != index) {
                    it
                } else if (end == null) {
                    it.copy(
                        milestone = milestone,
                        later = true,
                        startDate = null,
                        endDate = null,
                        precision = null,
                        checkpoint = LATER_CHALLENGE,
                    )
                } else {
                    it.copy(milestone = milestone, endDate = end, startDate = start ?: it.startDate, precision = precision)
                }
            },
    )

    private fun page(
        plan: Plan,
        kind: String = "learn",
        title: String = "Learn Python",
    ) = learnerSummary(kind = kind, title = title).let { PlanPageState(it.goals.first(), plan, it) }

    /** Python by spring: every phase ends within a year and a half, so each is said by its month. */
    private fun monthPage() =
        page(
            undated(learnPlan(), LocalDate(2027, 3, 10), PlanFinishPrecision.MONTH)
                .phase(0, "Write small programs with variables and types", LocalDate(2026, 10, 14))
                .phase(1, "Organize data with lists and dictionaries", LocalDate(2026, 11, 10))
                .phase(2, "Build a small web app with Flask", LocalDate(2027, 1, 20))
                .phase(3, "Ship a project of your own", LocalDate(2027, 3, 10), start = LocalDate(2027, 1, 21)),
        )

    /** Mathematics at a few minutes a day: its later phases are years off, so they're said by their year. */
    private fun yearPage() =
        page(
            undated(learnPlan(), LocalDate(2031, 4, 1), PlanFinishPrecision.YEAR)
                .phase(0, "Solve linear equations and inequalities", LocalDate(2026, 10, 14))
                .phase(1, "Work with functions and their graphs", LocalDate(2027, 2, 20))
                .phase(2, "Find rates of change with derivatives", LocalDate(2029, 5, 1), PlanFinishPrecision.YEAR, LocalDate(2027, 2, 21))
                .phase(
                    3,
                    "Model change with differential equations",
                    LocalDate(2031, 4, 1),
                    PlanFinishPrecision.YEAR,
                    LocalDate(2029, 5, 2),
                ),
            title = "Mathematics",
        )

    /** More than ten years of work at this time: the last phase and the finish have no date yet. */
    private fun beyondPage() =
        page(
            undated(learnPlan(), null, null, PlanFinishReason.BEYOND_HORIZON)
                .phase(0, "Solve linear equations and inequalities", LocalDate(2026, 10, 14))
                .phase(1, "Work with functions and their graphs", LocalDate(2027, 2, 20))
                .phase(2, "Find rates of change with derivatives", LocalDate(2033, 5, 1), PlanFinishPrecision.YEAR, LocalDate(2027, 2, 21))
                .phase(3, "Reason about vector spaces and proofs", null),
            title = "Mathematics",
        )

    /** A plan of one phase: its bar still ends on the plan's finish. */
    private fun onePhasePage(): PlanPageState {
        val plan = undated(learnPlan(), LocalDate(2027, 3, 10), PlanFinishPrecision.MONTH)
        val only = plan.phases[1].copy(index = 0, milestone = "Organize data with lists and dictionaries", endDate = LocalDate(2027, 3, 10))
        return page(plan.copy(phases = listOf(only), currentPhase = 0))
    }

    /** French to B2: its phases are situations, named and not given a milestone. */
    private fun languagePage(): PlanPageState {
        val aim = ApiJson.decodeFromString(LanguageAim.serializer(), languageAimOf("B2", targetLanguage = "fr"))
        val plan =
            undated(learnPlan().copy(languageAim = aim), LocalDate(2027, 11, 6), PlanFinishPrecision.MONTH)
                .phase(2, null, LocalDate(2027, 4, 20))
                .phase(3, null, LocalDate(2027, 11, 6), start = LocalDate(2027, 4, 21))
        val named = listOf("Greetings and introductions", "At the café", "Getting around town", "Talking about work")
        return page(
            plan.copy(
                phases =
                    plan.phases.mapIndexed {
                        index,
                        it,
                        ->
                        it.copy(name = named[index])
                    },
            ),
            kind = "language",
            title = "French",
        )
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
    }

    private companion object {
        /** Core's challenge under a phase whose work has no place yet: owed, with no day. */
        val LATER_CHALLENGE =
            ApiJson.decodeFromString(
                PlanPhaseCheckpoint.serializer(),
                """{"date":null,"later":true,"locked":false,"planItemId":null,"precision":null,"state":"upcoming","when":"date"}""",
            )
    }
}
