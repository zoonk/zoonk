package com.zoonk.android.feature.plan

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChangePreview
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the Plan, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PlanScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1900dp-xxhdpi")
    fun phone() = capture("plan-phone")

    @Test
    @Config(qualifiers = "w411dp-h1900dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("plan-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3200dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("plan-phone-font200")
    }

    @Test
    @Config(qualifiers = "de-w411dp-h3200dp-xhdpi")
    fun phoneInGermanAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("plan-phone-de-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1600dp-xhdpi")
    fun medium() = capture("plan-medium")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("plan-expanded")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-night-xhdpi")
    fun expandedDark() = capture("plan-expanded-dark", dark = true)

    /** Robolectric copies only the activity's window, so a sheet's content is drawn here as it shows in its sheet. */
    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun sheetContents() {
        val page = page()
        val sheets: Map<String, @Composable ColumnScope.(PlanLinks) -> Unit> =
            mapOf(
                "plan-sheet-pace" to { links -> PaceDetails(page, page.plan.status!!.pace, links, onAdjust = {}) },
                "plan-sheet-progress" to
                    { links ->
                        PreparationDetails(progress(), forExam = false, lessons = Standing.Progress(progress(), 13, 46), links = links)
                    },
                "plan-sheet-phase-details" to { links -> PhaseDetails(page, page.plan.phases[1], links) },
                "plan-change-diff" to
                    { _ ->
                        PlanEffectDiff(planChange(effect = effect(""""lessonsRemoved":3""")).effect)
                        PlanEffectDiff(
                            planChange(
                                effect = effect(""""lessonsAdded":2,"endDateBefore":"2027-01-10","endDateAfter":"2027-01-20""""),
                            ).effect,
                        )
                    },
            )
        var shown by mutableStateOf(sheets.keys.first())
        compose.setContent {
            val links = PlanLinks(rememberAppNavigator(), page)
            ZoonkTheme {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
                        sheets.getValue(shown)(this, links)
                    }
                }
            }
        }
        sheets.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write(name, compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun editor() = captureEditor("plan-editor")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-night-xxhdpi")
    fun editorDarkMoreContrast() = captureEditor("plan-editor-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h4400dp-xhdpi")
    fun editorAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureEditor("plan-editor-font200")
    }

    /** The side panel's content at its width; Robolectric copies only the activity's window. */
    @Test
    @Config(qualifiers = "w400dp-h2600dp-xxhdpi")
    fun editorPanel() = captureEditor("plan-editor-panel", panel = true)

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun coverage() = captureCoverage("phone")

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun coverageDarkMoreContrast() = captureCoverage("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xhdpi")
    fun coverageAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureCoverage("phone-font200")
    }

    /** The coverage block and the sheets it opens; sheets are drawn inline, as Robolectric copies only the activity's window. */
    private fun captureCoverage(
        suffix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val learn = learnerSummary()
        val exam = learnerSummary(kind = "exam", title = "ENEM")
        val areas = "[${area(
            "Mathematics",
            focused = true,
        )},${area("Natural sciences")},${area("Languages")},${area("English", partOf = "Languages")}]"
        val goalPlan = coveragePlan(areas = areas)
        val goal = PlanPageState(learn.goals.first(), goalPlan, learn)
        val examPlan = coveragePlan(kind = "exam", fullCourse = true)
        val examPage = PlanPageState(exam.goals.first(), examPlan, exam)
        val found = TimeToCoverState.Answered(timeToCoverRevision(goalPlan), timeToCover(recommended = 75, fittingDate = "2027-04-18"))

        fun preview(
            operations: List<PlanOp>,
            end: String,
            added: Long,
        ) = PlanPreviewState.Loading(operations, goalPlan).let {
            it.resolve(
                it,
                com.zoonk.api.models.PlanChangePreview(
                    effect =
                        com.zoonk.api.models.PlanEffect(
                            endDateAfter = kotlinx.datetime.LocalDate.parse(end),
                            endDateBefore = kotlinx.datetime.LocalDate.parse("2027-01-31"),
                            lessonsAdded = added,
                            lessonsRemoved = 0,
                        ),
                    feasibility = null,
                    ready = true,
                    unchanged = false,
                ),
            )
        }
        val fasterTime = preview(listOf(PlanOp.DailyMinutes(75)), "2027-01-20", 14)
        val everything = preview(listOf(PlanOp.TargetDate(null)), "2028-03-10", 40)
        val parts: Map<String, @Composable ColumnScope.() -> Unit> =
            mapOf(
                "plan-coverage-found" to { PlanScheduleSection(goal, PlanEdits(timeToCover = found), EditorDrafts()) },
                "plan-coverage-ask" to { PlanScheduleSection(goal, PlanEdits(), EditorDrafts()) },
                "plan-coverage-working-out" to { PlanScheduleSection(goal, PlanEdits(pending = setOf(PlanPart.Schedule)), EditorDrafts()) },
                "plan-coverage-exam" to { PlanScheduleSection(examPage, PlanEdits(), EditorDrafts()) },
                "plan-date-study-everything" to { PlanDateSection(goal, PlanEdits(), EditorDrafts()) },
                "plan-sheet-focus" to { ChooseFocusBody(goal, PlanEdits(), onFocusTest = {}, onDone = {}) },
                "plan-sheet-study-everything" to { StudyEverythingBody(goal, PlanEdits(), everything, onPreview = {}, onDone = {}) },
                "plan-sheet-study-everything-checking" to {
                    StudyEverythingBody(
                        goal,
                        PlanEdits(),
                        PlanPreviewState.Loading(listOf(PlanOp.TargetDate(null)), goalPlan),
                        onPreview = {},
                        onDone = {},
                    )
                },
                "plan-sheet-focus-applied" to {
                    PlanChangeApplied(
                        page = goal,
                        title = "Where to focus",
                        description = "The subjects you pick come first and get more depth.",
                        latest =
                            EditorChange(
                                planChange(operations = """[{"kind":"focusAreas","areas":["Mathematics"]}]""", effect = effect()),
                            ),
                        icon = com.zoonk.android.R.drawable.ic_my_location,
                        onUndo = {},
                        onDone = {},
                    )
                },
                "plan-preview-result" to {
                    PlanPreviewResult(fasterTime, onApply = {}, onRetry = {}, onDismiss = {})
                },
            )
        var shown by mutableStateOf(parts.keys.first())
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    val part = parts.getValue(shown)
                    if (shown.startsWith("plan-sheet")) {
                        Column(Modifier.padding(top = 24.dp)) { part() }
                    } else {
                        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) { part() }
                    }
                }
            }
        }
        parts.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write("$name-$suffix", compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun captureEditor(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        panel: Boolean = false,
    ) {
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val plan =
            plan(
                """
                "schedule":{"dailyMinutes":45,"fullCourse":false,"lightWeeks":[],"studyDays":6,"targetDate":"2027-11-07",
                 "targetDateEstimated":false,"targetDateNamedMonth":false,"noticeDay":{"date":"2027-11-14","estimated":false},
                 "weekdayMinutes":[0,45,45,45,45,45,90]},
                "steering":{"difficultyBias":"harder","lessonsStudied":12,"practiceBias":"balanced","skippedActivities":[]},
                "writtenPractice":{"cadence":"weekly","finalWeeksFrom":"2027-09-01","parts":["the essay"]},
                $EDITOR_CHOICES
                """.trimIndent(),
            )
        val page = PlanPageState(summary.goals.first(), plan, summary)
        val latest = EditorChange(planChange(operations = """[{"kind":"setDailyMinutes","minutes":45}]""", effect = effect()))
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(top = 24.dp)) {
                        PlanEditorBody(page, PlanEdits(latest = latest), onClose = if (panel) ({}) else null)
                    }
                }
            }
        }
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    /** The prerequisites' sheet, drawn here as it shows in its sheet. */
    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun editorSheets() = captureEditorSheets("plan-editor-sheet")

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun editorSheetsDarkMoreContrast() = captureEditorSheets("plan-editor-sheet-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3000dp-xhdpi")
    fun editorSheetsAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureEditorSheets("plan-editor-sheet-font200")
    }

    private fun captureEditorSheets(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val page =
            PlanPageState(
                summary.goals.first(),
                plan(
                    """
                    "feasibility":{"coreFits":true,"coveredShare":0.78,"deadline":"2027-11-07","deepensMostAsked":false,"fits":false,
                     "measure":"exam","timeCovers":false},
                    $EDITOR_CHOICES
                    """.trimIndent(),
                ),
                summary,
            )
        val preview =
            ApiJson.decodeFromString<PlanChangePreview>(
                """
                {"effect":{"lessonsAdded":6,"lessonsRemoved":0,"topicsAdded":[{"area":"Matemática","topics":["Probabilidade","Estatística"]}]},
                 "feasibility":{"coreFits":true,"coveredShare":0.82,"fits":false,"measure":"exam"},"ready":true,"unchanged":false}
                """.trimIndent(),
            )
        val edits =
            PlanEdits(
                preview = { preview },
                adviseOnBases = { PlanBasesAdvice(daysLeft = 12, ready = true, recommended = PlanBasesAdvice.Recommended.QUICK) },
            )
        var bases by mutableStateOf(BasesDraft())
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(top = 24.dp)) {
                        BasesChoices(page, page.plan.bases!!, edits, bases, onDraft = { bases = it }, onDone = {})
                    }
                }
            }
        }
        compose.waitForIdle()
        write("$prefix-bases", compose.onRoot().captureToImage().asAndroidBitmap())

        compose.onNodeWithText("Get a recommendation").performClick()
        compose.onNodeWithText("Quick lesson").performClick()
        compose.mainClock.advanceTimeBy(1_000)
        compose.waitForIdle()
        write("$prefix-bases-changed", compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        show(dark, moreContrast)
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun show(
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val page = page()
        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    PlanContent(
                        page = page,
                        standing = Standing.Progress(progress(), done = 13, total = 46),
                        structure = null,
                        links = PlanLinks(navigator, page),
                        resume = Resume.Plain,
                        isSaving = false,
                        onSetStatus = {},
                        onAdjust = {},
                    )
                }
            }
        }
    }

    private fun page() = PlanPageState(learnerSummary().goals.first(), learnPlan(), learnerSummary())

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        val EDITOR_CHOICES =
            """
            "examChoices":[{"group":"Língua estrangeira","options":[{"name":"Inglês","shortName":null},
             {"name":"Espanhol","shortName":null}],"subject":null}],
            "bases":{"daysLeft":12,"knownCount":1,"items":[
             {"area":"Matemática","choice":"essential","choices":["deep","essential","quick","skip"],
              "minutes":{"deep":120,"essential":40,"quick":10},"name":"Frações","neededFor":["Probabilidade"],
              "skillId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b01","studied":false},
             {"area":"Matemática","choice":"essential","choices":["deep","essential","quick","skip"],
              "minutes":{"deep":90,"essential":30,"quick":10},"name":"Razão e proporção","neededFor":[],
              "skillId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b02","studied":false},
             {"area":"Linguagens","choice":"essential","choices":["deep"],
              "minutes":{"deep":60,"essential":20,"quick":10},"name":"Classes de palavras","neededFor":[],
              "skillId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b03","studied":true}]}
            """.trimIndent()
    }
}
