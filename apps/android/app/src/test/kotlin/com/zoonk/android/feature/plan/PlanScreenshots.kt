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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.SkillOutline
import com.zoonk.api.models.SkillOutlineChapter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
import java.util.UUID

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

    /** A far topic's sheet in each state, driven through its view model as the sheet is. */
    @Test
    @Config(qualifiers = "w411dp-h900dp-xxhdpi")
    fun farTopic() {
        val api = FakePlanApi()
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = PlanStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
        val topics = FarTopicViewModel(store, UUID.fromString(GOAL))
        val flask = FarTopic(UUID.fromString(FAR_SKILL), "Flask", lessons = 6, nextDate = LocalDate(2026, 12, 21))
        val available = { SkillOutline(emptyList(), SkillOutline.Status.AVAILABLE) }
        compose.setContent {
            val navigator = rememberAppNavigator()
            val open by topics.sheet.collectAsStateWithLifecycle()
            ZoonkTheme {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    open?.let { FarTopicContent(it, topics, navigator, onChapter = {}, modifier = Modifier.padding(24.dp)) }
                }
            }
        }

        fun shot(
            name: String,
            setUp: () -> Unit,
        ) {
            compose.runOnIdle {
                topics.close()
                setUp()
            }
            compose.waitForIdle()
            write("far-topic-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }

        shot("available") { topics.open(flask) }
        shot("writing") {
            api.outline = { SkillOutline(emptyList(), SkillOutline.Status.WRITING) }
            topics.open(flask)
        }
        shot("ready") {
            api.outline = {
                SkillOutline(
                    listOf(
                        SkillOutlineChapter(UUID.fromString(CHAPTER_NEXT), "Routes, views and the request cycle in a small Flask app"),
                        SkillOutlineChapter(UUID.fromString(CHAPTER_LATER), "Templates"),
                    ),
                    SkillOutline.Status.READY,
                )
            }
            topics.open(flask)
        }
        shot("refused") {
            api.outline = available
            api.writeOutline = {
                throw ApiException(
                    ApiError.Unavailable,
                    "USAGE_LIMIT_REACHED",
                    402,
                    ApiJson.parseToJsonElement("""{"limit":{"period":"day","tier":"free"}}"""),
                )
            }
            topics.open(flask)
            topics.request()
        }
        shot("unreachable") {
            api.outline = { throw ApiException(ApiError.Network) }
            topics.open(flask)
        }
        shot("nothing-left") {
            api.outline = available
            api.writeOutline = { throw ApiException(ApiError.Unavailable, status = 422) }
            topics.open(flask)
            topics.request()
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

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun slot() = captureSlot("phone")

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun slotDarkMoreContrast() = captureSlot("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xhdpi")
    fun slotAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureSlot("phone-font200")
    }

    /** Each item as a line, then as the panel it is beside the page, which is also what its sheet shows. */
    private fun captureSlot(
        suffix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val learn = learnerSummary()
        val exam = learnerSummary(kind = "exam", title = "ENEM")
        val goalPlan = coveragePlan(areas = "[${area("Mathematics")},${area("Natural sciences")}]")
        val fitPlan =
            plan(
                """"fitOffer":{"canApply":true,"fits":false,"operations":[{"kind":"fitLessons"}],"effect":{"lessonsAdded":6,""" +
                    """"lessonsRemoved":0,"topicsAdded":[{"area":"Web apps","topics":["Flask","Django","FastAPI"]}]}}""",
            )
        val pagedPlan = fitPlan.copy(status = learnPlan().status)
        val pastDate = plan(""""status":{"kind":"pastDate","lessons":4}""")
        val found = TimeToCoverState.Answered(timeToCoverRevision(goalPlan), timeToCover(recommended = 75))
        val moved = listOf<PlanOp>(PlanOp.TargetDate(java.time.LocalDate.parse("2027-04-18")))
        val change = planChange(operations = """[{"kind":"setDailyMinutes","minutes":75}]""", effect = effect(""""lessonsAdded":14"""))
        val course = java.util.UUID.fromString(CHANGE_ID)
        val next =
            com.zoonk.api.models.StudyNext(
                nextLevel =
                    com.zoonk.api.models.StudyNextNextLevel(
                        0,
                        course,
                        com.zoonk.api.models.StudyNextNextLevel.Level.INTERMEDIATE,
                        "Python",
                    ),
                related =
                    listOf(
                        com.zoonk.api.models
                            .StudyNextRelatedInner("zoonk", course, "data-science", "Data science with Python"),
                        com.zoonk.api.models
                            .StudyNextRelatedInner("zoonk", course, "web", "Web apps with Flask"),
                    ),
            )

        fun ready(
            operations: List<PlanOp>,
            plan: com.zoonk.api.models.Plan,
        ) = PlanPreviewState.Loading(operations, plan).let {
            it.resolve(
                it,
                PlanChangePreview(
                    effect =
                        ApiJson.decodeFromString(
                            effect(""""lessonsAdded":14,"endDateBefore":"2027-01-31","endDateAfter":"2027-04-18""""),
                        ),
                    feasibility = null,
                    ready = true,
                    unchanged = false,
                ),
            )
        }

        class Shot(
            val plan: com.zoonk.api.models.Plan,
            val summary: com.zoonk.api.models.LearnerSummary = learn,
            val edits: PlanEdits = PlanEdits(),
            val host: SlotHost = SlotHost(),
            val state: () -> SlotState = { SlotState() },
        )
        val shots =
            mapOf(
                "plan-slot-coverage-ask" to Shot(goalPlan),
                "plan-slot-coverage-found" to Shot(goalPlan, edits = PlanEdits(timeToCover = found)),
                "plan-slot-coverage-preview" to
                    Shot(
                        goalPlan,
                        edits = PlanEdits(timeToCover = found),
                        host = SlotHost(preview = ready(listOf(PlanOp.DailyMinutes(75)), goalPlan)),
                    ),
                "plan-slot-coverage-checking-date" to
                    Shot(
                        goalPlan,
                        edits = PlanEdits(timeToCover = TimeToCoverState.Pending(timeToCoverRevision(goalPlan))),
                        state = { SlotState(intent = CoverageIntent.Date) },
                    ),
                "plan-slot-coverage-applied" to
                    Shot(goalPlan, edits = PlanEdits(changes = mapOf(change.id to EditorChange(change))), state = {
                        SlotState().apply { result = SlotResult(SlotItem.Coverage, change) }
                    }),
                "plan-slot-fit" to Shot(fitPlan),
                "plan-slot-paged" to Shot(pagedPlan, state = { SlotState(position = 1) }),
                "plan-slot-paged-applied" to
                    Shot(pagedPlan, edits = PlanEdits(changes = mapOf(change.id to EditorChange(change))), state = {
                        SlotState(position = 1).apply { result = SlotResult(SlotItem.FitLessons, change) }
                    }),
                "plan-slot-past-date" to Shot(pastDate),
                "plan-slot-past-date-exam" to Shot(pastDate, summary = exam),
                "plan-slot-past-date-preview" to Shot(pastDate, host = SlotHost(preview = ready(moved, pastDate))),
                "plan-slot-past-date-no-date" to Shot(pastDate, state = { SlotState().apply { dateSearch = DateSearch.NoDate } }),
                "plan-slot-finished" to Shot(plan(), host = SlotHost(next = next)),
                "plan-slot-finished-starting" to Shot(plan(), host = SlotHost(next = next, nextLevel = NextLevelStart.Starting)),
            )
        var shown by mutableStateOf(shots.keys.first())
        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    val shot = shots.getValue(shown)
                    val page = PlanPageState(shot.summary.goals.first(), shot.plan, shot.summary)
                    androidx.compose.runtime.key(shown) {
                        val state = androidx.compose.runtime.remember { shot.state() }
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            SuggestionLayout.entries.forEach { layout ->
                                PlanSuggestionSlot(
                                    page,
                                    shot.edits,
                                    PlanLinks(navigator, page),
                                    Resume.Plain,
                                    {},
                                    onAdjust = {},
                                    layout = layout,
                                    host = shot.host,
                                    state = state,
                                )
                            }
                        }
                    }
                }
            }
        }
        shots.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write("$name-$suffix", compose.onRoot().captureToImage().asAndroidBitmap())
        }
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

    /** The prerequisites' and a tool's sheets, drawn here as they show in their sheets. */
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
        var sheet by mutableStateOf("bases")
        var bases by mutableStateOf(BasesDraft())
        var tool by mutableStateOf(ToolDraft("Spreadsheet (Google Sheets or Excel)", choice = null, system = null))
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(top = 24.dp)) {
                        when (sheet) {
                            "bases" -> BasesChoices(page, page.plan.bases!!, edits, bases, onDraft = { bases = it }, onDone = {})
                            else -> ToolChoiceForm(page.plan.tools.first(), tool, edits, onDraft = { tool = it }, onDone = {})
                        }
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

        sheet = "tool"
        compose.waitForIdle()
        compose.onNodeWithText("I'll set it up").performClick()
        compose.waitForIdle()
        write("$prefix-tool", compose.onRoot().captureToImage().asAndroidBitmap())
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
              "skillId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b03","studied":true}]},
            "tools":[{"choice":null,"essential":true,"later":false,"name":"Spreadsheet (Google Sheets or Excel)","system":null},
             {"choice":"have","essential":false,"later":false,"name":"Scientific calculator","system":null},
             {"choice":null,"essential":false,"later":true,"name":"Python","system":null}]
            """.trimIndent()
    }
}
