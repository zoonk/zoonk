package com.zoonk.android.feature.today

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.WindowManager
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.goalcontent.examSyllabus
import com.zoonk.android.feature.goalcontent.modulesSyllabus
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.StudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockOpening
import com.zoonk.api.models.StudyBlockOpeningTarget
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TodayFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val session = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d02"
    private val lesson = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d31"
    private val lessonBlock = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d41"
    private val reviewBlock = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d42"
    private val opening = OpeningApi()
    private val spinning = hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)

    private fun show(
        vararg sessionFields: Pair<String, Any?>,
        todayFields: List<Pair<String, Any?>> = emptyList(),
        plans: FakePlanApi = FakePlanApi(),
        moreContrast: Boolean = false,
    ) {
        val blocks =
            JsonArray(
                listOf(
                    fixture(
                        "study-block",
                        "id" to lessonBlock,
                        "kind" to "learn",
                        "screen" to "lesson",
                        "lessonId" to lesson,
                        "position" to 0,
                        "title" to "Cells",
                    ),
                    fixture(
                        "study-block",
                        "id" to reviewBlock,
                        "kind" to "review",
                        "screen" to "session",
                        "position" to 1,
                        "estimatedMinutes" to 8,
                    ),
                ),
            )
        val minutes =
            buildJsonObject {
                put("dailyGoal", 20)
                put("left", 20)
                put("done", 0)
                put("planned", 20)
            }
        val day =
            fixture(
                "study-session",
                "id" to session,
                "status" to "active",
                "blocks" to blocks,
                "nextPosition" to 0,
                "minutes" to minutes,
                "state" to "underway",
                *sessionFields,
            ).withSessionBar()
        val today = decodeFixture<Today>("today", "session" to day, *todayFields.toTypedArray())
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        todayApi.shown = today
        val store = TodayStore(todayApi, cache, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate), timeZone = { "UTC" })
        val viewModel =
            TodayViewModel(
                StudyOpener(opening, { _, _ -> error("Not used") }, cache, timeZone = { "UTC" }),
                store,
                PlanStore(plans, cache),
                unusedFocusTests(cache),
            )
        val read = TodayRead.Day(today, today.session.toDayView())
        val onboarding = OnboardingStore(FakeOnboardingApi(), cache, FakeSession(ana)) { SignInResult.SignedIn }

        rule.setContent {
            ZoonkTheme(moreContrast = moreContrast) {
                Surface {
                    navigator = rememberAppNavigator()
                    LaunchedEffect(viewModel) { viewModel.routes.collect { navigator.open(it.route) } }
                    TodayDay(
                        read,
                        store.today,
                        false,
                        viewModel,
                        navigator,
                        PaddingValues(),
                        buddy =
                            com.zoonk.android.ui.characters
                                .BuddyLook(),
                        buddyName = "Zu",
                        language = null,
                        onboarding = onboarding,
                        plans = PlanStore(plans, cache),
                        refreshIfChanged = store::refreshIfChanged,
                    )
                }
            }
        }
    }

    @Test
    @Config(qualifiers = "w411dp-h3000dp")
    fun aWaitingDayHasNoProgressBarBeforeAnyLessonIsListed() {
        show("blocks" to JsonArray(emptyList()), "state" to "waiting", "lessonsComing" to true, "minutes" to timeLeft(240.0))

        rule.onAllNodes(normalizedDescription("0 of 0 done")).assertCountEquals(0)
    }

    @Test
    @Config(qualifiers = "w411dp-h3000dp")
    fun oneLessonAndHeldTimeShowProgress() {
        show("blocks" to sevenMinuteLessons(1), "lessonsComing" to true, "minutes" to timeLeft(30.0))

        rule.onAllNodes(normalizedDescription("0 of 1 done")).assertCountEquals(1)
    }

    @Test
    @Config(qualifiers = "w411dp-h3000dp")
    fun oneLessonWithoutHeldTimeHasNoProgressBar() {
        show("blocks" to sevenMinuteLessons(1), "minutes" to timeLeft(7.0))

        rule.onAllNodes(normalizedDescription("0 of 1 done")).assertCountEquals(0)
    }

    private fun normalizedDescription(text: String) =
        SemanticsMatcher("description: $text") { node ->
            node.config.getOrNull(SemanticsProperties.ContentDescription)?.any { it.replace('\u00a0', ' ') == text } == true
        }

    private fun normalizedText(text: String) =
        SemanticsMatcher("text: $text") { node ->
            node.config.getOrNull(SemanticsProperties.Text)?.any { it.text.replace('\u00a0', ' ') == text } == true
        }

    private fun timeLeft(left: Double) =
        buildJsonObject {
            put("dailyGoal", 240)
            put("left", left)
            put("done", 0)
            put("planned", 240)
        }

/** Core's count for the blocks the test shows: skipped blocks count neither as done nor in the total. */
    private fun JsonObject.withSessionBar(): JsonObject {
        val statuses = getValue("blocks").jsonArray.map { it.jsonObject["status"]?.jsonPrimitive?.content }
        val bar =
            buildJsonObject {
                put("completed", statuses.count { it == "completed" })
                put("total", statuses.count { it != "skipped" })
            }
        return JsonObject(this + ("sessionBar" to bar))
    }

    private fun sevenMinuteLessons(count: Int) =
        JsonArray(
            (0 until count).map { index ->
                fixture(
                    "study-block",
                    "position" to index,
                    "estimatedMinutes" to 7,
                    "kind" to "learn",
                    "screen" to "lesson",
                    "title" to "Lesson ${index + 1}",
                )
            },
        )

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderProgressOnAPhone() = render("today-progress-phone")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderProgressOnATablet() = render("today-progress-tablet")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderPreparationOnATablet() = render("today-preparation-tablet", exam = true)

    @Test
    @Config(qualifiers = "w1280dp-h1400dp-land-xhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderProgressOnATabletAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        render("today-progress-tablet-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h1000dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderComingLessonsOnAPhone() =
        render("today-coming-not-written-phone") { show("blocks" to practiceOnly(), "lessonsToPrepare" to true) }

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h1000dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderHeldTimeOnAPhone() = renderHeldTime("today-held-time-phone-pt")

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h1000dp-night-xxhdpi", fontScale = 2f)
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderHeldTimeWithLargeTextInDark() = renderHeldTime("today-held-time-phone-pt-dark-contrast-font200", moreContrast = true)

    @Test
    @Config(qualifiers = "pt-rBR-w1280dp-h900dp-land-xhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderHeldTimeOnATablet() = renderHeldTime("today-held-time-tablet-pt")

    @Test
    @Config(qualifiers = "pt-rBR-w700dp-h1000dp-xhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderHeldTimeOnAMediumWindow() = renderHeldTime("today-held-time-medium-pt")

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h891dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderWaitingTimeOnAPhone() = renderHeldTime("today-waiting-time-phone-pt", waiting = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderSegmentPopoverOnAPhone() =
        renderPopover("today-segment-popover-phone", descriptionContaining(": 8 min")) {
            show("lessonsComing" to true)
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderHeldSegmentPopoverOnAPhone() =
        renderPopover("today-held-segment-popover-phone", descriptionContaining("Your next lessons")) {
            show("lessonsComing" to true)
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderWeekDayPopoverOnAPhone() =
        renderPopover("today-week-day-popover-phone", descriptionContaining("Monday:")) {
            show("week" to studiedWeek(), todayFields = listOf("weeklyChallenge" to weeklyChallenge("2026-10-26")))
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun renderStudiedWeekDayPopoverInDark() =
        renderPopover("today-week-day-popover-phone-dark", descriptionContaining("Tuesday:")) {
            show("week" to studiedWeek())
        }

    /** The screen with nothing open, then the popover its [anchor] opens. */
    private fun renderPopover(
        name: String,
        anchor: SemanticsMatcher,
        shown: () -> Unit,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        shown()
        rule.waitForIdle()
        save(rule.onRoot(), File(folder, "$name-closed.png"))
        rule.onNode(anchor and hasClickAction()).performClick()
        rule.waitForIdle()
        val roots = rule.onAllNodes(isRoot())
        val bitmap = roots[0].captureRender().asAndroidBitmap().copy(Bitmap.Config.ARGB_8888, true)
        // Robolectric's PixelCopy reads only the activity's window, so the popover's window is drawn over it.
        val popup = (roots.onLast().fetchSemanticsNode().root as ViewRootForTest).view.rootView
        val params = popup.layoutParams as WindowManager.LayoutParams
        Canvas(bitmap).apply {
            translate(params.x.toFloat(), params.y.toFloat())
            popup.draw(this)
        }
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun save(
        node: SemanticsNodeInteraction,
        file: File,
    ) {
        file.parentFile?.mkdirs()
        file.outputStream().use { node.captureRender().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun descriptionContaining(text: String) =
        SemanticsMatcher("description containing: $text") { node ->
            node.config.getOrNull(SemanticsProperties.ContentDescription)?.any { it.replace('\u00a0', ' ').contains(text) } == true
        }

    private fun studiedWeek() =
        buildJsonObject {
            put(
                "days",
                JsonArray(
                    listOf(
                        weekDay("2026-10-26", minutes = 25, hitGoal = true),
                        weekDay("2026-10-27", minutes = 10),
                        weekDay("2026-10-28", isToday = true),
                        weekDay("2026-10-29"),
                        weekDay("2026-10-30"),
                        weekDay("2026-10-31", kind = "rest", goal = 0),
                        weekDay("2026-11-01"),
                    ),
                ),
            )
            put("nextStudyDate", JsonNull)
        }

    private fun weekDay(
        date: String,
        minutes: Int = 0,
        goal: Int = 20,
        hitGoal: Boolean = false,
        isToday: Boolean = false,
        kind: String = "study",
    ) = buildJsonObject {
        put("date", date)
        put("goalMinutes", goal)
        put("hitGoal", hitGoal)
        put("isToday", isToday)
        put("kind", kind)
        put("minutes", minutes)
        put("studied", minutes > 0)
    }

    private fun weeklyChallenge(date: String) =
        buildJsonObject {
            put("access", "open")
            put("date", date)
            put("kind", "mixed")
            put("planItemId", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d51")
            put("questions", 20)
            put("timeLimitMinutes", JsonNull)
            put("title", "Weekly challenge")
        }

    private fun renderHeldTime(
        name: String,
        waiting: Boolean = false,
        moreContrast: Boolean = false,
    ) = render(name) {
        val blocks =
            JsonArray(
                listOf(7, 7, 7, 7, 7, 7, 7, 6, 6).mapIndexed { index, minutes ->
                    fixture(
                        "study-block",
                        "position" to index,
                        "estimatedMinutes" to minutes,
                        "kind" to "learn",
                        "screen" to "lesson",
                        "title" to "Aula ${index + 1}",
                    )
                },
            )
        show(
            "blocks" to if (waiting) JsonArray(emptyList()) else blocks,
            "state" to if (waiting) "waiting" else "underway",
            "lessonsComing" to true,
            "minutes" to
                buildJsonObject {
                    put("dailyGoal", 240)
                    put("left", 240)
                    put("done", 0)
                    put("planned", 240)
                },
            moreContrast = moreContrast,
        )
    }

    /** Review renders, written only with `-Pzoonk.shots=<folder>`. No goldens. */
    private fun render(
        name: String,
        exam: Boolean = false,
        shown: (() -> Unit)? = null,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        if (shown != null) {
            shown()
        } else if (exam) {
            val goal = fixture("today")["goal"]?.let { JsonObject(it.jsonObject + ("kind" to JsonPrimitive("exam"))) }
            val preparation =
                buildJsonObject {
                    put("measure", "preparation")
                    put("status", JsonNull)
                    put("value", 0.37)
                    put("weekGain", 0.05)
                }
            show(
                todayFields = listOf("goal" to goal, "progress" to preparation),
                plans =
                    FakePlanApi().apply {
                        shownSyllabus =
                            examSyllabus()
                    },
            )
        } else {
            show(
                todayFields = listOf("progress" to lessonsProgress(done = 3, today = 2, total = 20)),
                plans = FakePlanApi().apply { shownSyllabus = modulesSyllabus() },
            )
        }
        rule.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use {
            rule
                .onRoot()
                .captureRender()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    @Test
    fun aDayLeftOpenAsksWhetherItChangedUntilTheLearnersAskLapsesThenSaysItsTakingLonger() {
        show("blocks" to practiceOnly(), "lessonsComing" to true)

        rule.mainClock.advanceTimeBy(10.minutes.plus(30.seconds).inWholeMilliseconds)
        rule.onNodeWithText("Getting ready…").assertExists()

        rule.mainClock.advanceTimeBy(5.minutes.inWholeMilliseconds)
        rule.onNodeWithText("Taking longer than usual").assertExists()
        val asks = todayApi.asked.size
        assertTrue("asked $asks times", asks >= 180)
        assertEquals(1, todayApi.reads)

        rule.mainClock.advanceTimeBy(5.minutes.inWholeMilliseconds)
        assertEquals(asks, todayApi.asked.size)
    }

    @Test
    fun anAskRenewedElsewhereKeepsTheWaitGoingPastTheFirstAsksLapse() {
        show("blocks" to practiceOnly(), "lessonsComing" to true)
        rule.mainClock.advanceTimeBy(14.minutes.inWholeMilliseconds)

        todayApi.changed = true
        rule.mainClock.advanceTimeBy(10.seconds.inWholeMilliseconds)
        todayApi.changed = false
        rule.mainClock.advanceTimeBy(10.minutes.inWholeMilliseconds)
        rule.onNodeWithText("Getting ready…").assertExists()

        rule.mainClock.advanceTimeBy(6.minutes.inWholeMilliseconds)
        rule.onNodeWithText("Taking longer than usual").assertExists()
    }

    @Test
    fun theUpNextRowSpinsAloneWhileKeepLearningWaits() {
        show("state" to "done", "extraTime" to upNext())

        rule.onNodeWithText("Membranes").performClick()
        rule.waitForIdle()

        rule.onAllNodes(spinning, useUnmergedTree = true).assertCountEquals(1)
        rule.onAllNodes(spinning and hasAnySibling(hasText("Keep learning")), useUnmergedTree = true).assertCountEquals(0)
        rule.onNodeWithText("Keep learning").assertIsNotEnabled()
    }

    @Test
    fun keepLearningSpinsAloneWhileTheUpNextRowWaits() {
        show("state" to "done", "extraTime" to upNext())

        rule.onNodeWithText("Keep learning").performClick()
        rule.waitForIdle()

        rule.onAllNodes(spinning, useUnmergedTree = true).assertCountEquals(1)
        rule.onAllNodes(spinning and hasAnySibling(hasText("Keep learning")), useUnmergedTree = true).assertCountEquals(1)
        rule.onNodeWithText("Membranes").assertIsNotEnabled()
    }

    @Test
    fun theWaitingUpNextRowKeepsFocusWhileKeepLearningsRequestRuns() {
        show("state" to "done", "extraTime" to upNext())
        val row = rule.onNodeWithText("Membranes")
        row.performSemanticsAction(SemanticsActions.RequestFocus)
        row.assertIsFocused()

        rule.onNodeWithText("Keep learning").performClick()
        rule.waitForIdle()

        row.assertIsNotEnabled().assertIsFocused()
    }

    private fun upNext() =
        buildJsonObject {
            put("available", true)
            put(
                "lessons",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("minutes", 5)
                            put("title", "Membranes")
                        },
                    ),
                ),
            )
            put("minutes", 5)
            put("reason", JsonNull)
        }

    private fun practiceOnly() =
        JsonArray(
            listOf(
                fixture(
                    "study-block",
                    "id" to reviewBlock,
                    "kind" to "review",
                    "screen" to "session",
                    "position" to 0,
                    "estimatedMinutes" to 8,
                ),
            ),
        )

    private fun lessonsProgress(
        done: Int,
        today: Int,
        total: Int,
    ) = buildJsonObject {
        putJsonObject("lessons") {
            put("done", done)
            put("today", today)
            put("total", total)
        }
        put("measure", "lessons")
        put("status", JsonNull)
        put("value", done.toDouble() / total)
    }

    private class OpeningApi : StudyApi {
        /** Holds the block "Keep learning" adds, so its wait stays on screen. */
        val extraBlockGate = CompletableDeferred<Unit>()

        override suspend fun openDay(
            session: AuthenticatedSession,
            goalId: UUID,
            body: OpenStudyDayRequest,
        ): OpenedStudyDay = error("The day is saved")

        override suspend fun openBlock(
            session: AuthenticatedSession,
            target: StudyBlockOpeningTarget,
            timeZone: String,
        ): StudyBlockOpening = error("Not used")

        override suspend fun stop(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun summary(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySessionSummary = error("Not used")

        override suspend fun addExtraBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudyBlock? {
            extraBlockGate.await()
            error("Not used")
        }

        override suspend fun catchUp(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun session(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySession = error("Not used")
    }

    private val todayApi = ShownTodayApi()

    /** Reads Today as the test shows it, so a poll reads the same day again. */
    private class ShownTodayApi : TodayApi {
        var shown: Today? = null
        var reads = 0
        var changed = false
        val asked = mutableListOf<Instant>()

        override suspend fun today(
            session: AuthenticatedSession,
            timeZone: String,
        ): Today {
            reads++
            return shown ?: error("Shown from the test's read")
        }

        override suspend fun todayChanged(
            session: AuthenticatedSession,
            goalId: UUID,
            since: Instant,
        ): Boolean {
            asked += since
            return changed
        }

        override suspend fun brainPower(session: AuthenticatedSession): Long? = null

        override suspend fun mistakes(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = GoalMistakes(MistakeListAvailability(ready = 0, tomorrow = 0), total = 0)

        override suspend fun language(
            session: AuthenticatedSession,
            goalId: UUID,
        ): com.zoonk.api.models.LanguageToday = error("Not used")

        override suspend fun resumePreview(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = false

        override suspend fun resume(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = Unit

        override suspend fun answerInsight(
            session: AuthenticatedSession,
            insightId: UUID,
            accepted: Boolean,
            quote: String?,
        ): MemoryInsight = error("Not used")

        override suspend fun prepareLessons(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = Unit

        override suspend fun answerSuggestedGoal(
            session: AuthenticatedSession,
            suggestionId: UUID,
            accepted: Boolean,
        ): SuggestedGoal = error("Not used")
    }
}
