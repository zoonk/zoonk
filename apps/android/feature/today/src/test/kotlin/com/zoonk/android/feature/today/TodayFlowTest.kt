package com.zoonk.android.feature.today

import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
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

    private fun show(
        vararg sessionFields: Pair<String, Any?>,
        todayFields: List<Pair<String, Any?>> = emptyList(),
        plans: FakePlanApi = FakePlanApi(),
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
            )
        val today = decodeFixture<Today>("today", "session" to day, *todayFields.toTypedArray())
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        todayApi.shown = today
        val store = TodayStore(todayApi, cache, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate), timeZone = { "UTC" })
        val viewModel =
            TodayViewModel(
                StudyOpener(OpeningApi(), { _, _ -> error("Not used") }, cache, timeZone = { "UTC" }),
                store,
                PlanStore(plans, cache),
            )
        val read = TodayRead.Day(today, today.session.toDayView())
        val onboarding = OnboardingStore(FakeOnboardingApi(), cache, FakeSession(ana)) { SignInResult.SignedIn }

        rule.setContent {
            ZoonkTheme {
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
        rule.onNodeWithText("Being written for you…").assertExists()

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
        rule.onNodeWithText("Being written for you…").assertExists()

        rule.mainClock.advanceTimeBy(6.minutes.inWholeMilliseconds)
        rule.onNodeWithText("Taking longer than usual").assertExists()
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
        ): StudyBlock = error("Not used")

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
        ) = Unit

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
