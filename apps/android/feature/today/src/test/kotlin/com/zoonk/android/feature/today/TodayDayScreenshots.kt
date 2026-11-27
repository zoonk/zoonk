package com.zoonk.android.feature.today

import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.challenge.MockScheduleStore
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review renders of Today's day in each of its states, on demand: `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TodayDayScreenshots {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun underwayPhone() = render("today-underway-phone", underway())

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun writtenPhone() = render("01-today", written())

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun underwayTablet() = render("today-underway-tablet", underway())

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun unfinishedGoalPhone() = render("today-unfinished-goal-phone", underway(), unfinished = UNFINISHED_GOAL)

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun unfinishedGoalPhoneDark() = render("today-unfinished-goal-phone-dark", underway(), unfinished = UNFINISHED_GOAL)

    @Test
    @Config(qualifiers = "w411dp-h3000dp-xxhdpi")
    fun unfinishedGoalPhoneLargeText() {
        RuntimeEnvironment.setFontScale(2f)
        render("today-unfinished-goal-phone-font200", underway(), unfinished = UNFINISHED_GOAL)
    }

    @Test
    @Config(qualifiers = "w411dp-h1700dp-xxhdpi")
    fun unfinishedGoalUnderANoticePhone() {
        val focusTest = buildJsonObject { put("minutes", 15) }
        val day = Day(underway().session, listOf("notice" to "focusTest", "focusTest" to focusTest))
        render("today-unfinished-goal-under-notice-phone", day, unfinished = UNFINISHED_GOAL)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun unfinishedGoalOverAPausedGoalPhone() =
        render("today-unfinished-goal-paused-phone", underway(), unfinished = UNFINISHED_GOAL, paused = true)

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun unfinishedGoalTablet() = render("today-unfinished-goal-tablet", underway(), unfinished = UNFINISHED_GOAL)

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun remedialPhone() = render("today-remedial-phone", remedial())

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun remedialPhoneDark() = render("today-remedial-phone-dark", remedial())

    @Test
    @Config(qualifiers = "w411dp-h3000dp-xxhdpi")
    fun remedialPhoneLargeText() {
        RuntimeEnvironment.setFontScale(2f)
        render("today-remedial-phone-font200", remedial())
    }

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun remedialLanguagePhone() = render("today-remedial-language-phone", remedial(language = true))

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun mistakesAlreadyFixedPhone() = render("today-mistakes-already-fixed-phone", remedial(oneSubject = true, mistakesLeft = 0))

    @Test
    @Config(qualifiers = "w411dp-h1500dp-night-xxhdpi")
    fun mistakesAlreadyFixedPhoneDark() = render("today-mistakes-already-fixed-phone-dark", remedial(oneSubject = true, mistakesLeft = 0))

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun remedialOneSubjectPhone() = render("today-remedial-one-subject-phone", remedial(oneSubject = true))

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun doneKeepLearningPhone() = render("today-done-phone", done())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun restWithLessonsPhone() = render("today-rest-phone", rest())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun caughtUpPhone() = render("today-caught-up-phone", caughtUp())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun planFinishedPhone() = render("today-plan-finished-phone", caughtUp(finished = true))

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun waitingPhone() = render("today-waiting-phone", waiting())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun lessonsNotReadyPhone() = render("today-lessons-not-ready-phone", prepare())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun pastDatePhone() = render("today-past-date-phone", pastDate())

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun pastDateTablet() = render("today-past-date-tablet", pastDate())

    @Test
    @Config(qualifiers = "w411dp-h1500dp-xxhdpi")
    fun earlierLessonsPhone() = render("today-earlier-lessons-phone", earlierLessons())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun strategyLessonPhone() = render("today-strategy-lesson-phone", strategy())

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun strategyLessonGuidePhone() = render("today-strategy-lesson-guide-phone", strategy(document = "guide"))

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun followedNoticePhone() =
        render("today-followed-notice-phone", followedNotice(listOf("Língua Portuguesa", "Raciocínio Lógico", "Língua Inglesa")))

    @Test
    @Config(qualifiers = "w411dp-h1100dp-night-xxhdpi")
    fun followedNoticeManyDarkPhone() =
        render(
            "today-followed-notice-many-dark-phone",
            followedNotice(
                listOf("Língua Portuguesa", "Raciocínio Lógico", "Língua Inglesa", "Direito Constitucional", "Estratégia de prova"),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun followedNoticeLargeTextPhone() {
        RuntimeEnvironment.setFontScale(2f)
        render(
            "today-followed-notice-font200-phone",
            followedNotice(listOf("Língua Portuguesa", "Raciocínio Lógico", "Língua Inglesa", "Direito Constitucional")),
        )
    }

    @Test
    @Config(qualifiers = "w411dp-h1100dp-xxhdpi")
    fun mockExamPhone() = render("today-mock-exam-phone", mockExam(), schedule = true)

    @Test
    @Config(qualifiers = "w411dp-h1100dp-night-xxhdpi")
    fun mockExamPhoneDark() = render("today-mock-exam-phone-dark", mockExam(), schedule = true)

    private class Day(
        val session: JsonObject,
        val today: List<Pair<String, Any?>> = emptyList(),
    )

    private fun render(
        name: String,
        day: Day,
        unfinished: String? = null,
        paused: Boolean = false,
        schedule: Boolean = false,
    ) {
        val session = JsonObject(day.session + ("sessionBar" to sessionBar(day.session)))
        val today = decodeFixture<Today>("today", "session" to session, *day.today.toTypedArray())
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store =
            TodayStore(
                FakeTodayApi(listOf(today)),
                cache,
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                timeZone = { "UTC" },
            )
        val viewModel =
            TodayViewModel(
                StudyOpener(FakeStudyApi(), { _, _ -> error("Not used") }, cache, timeZone = { "UTC" }),
                store,
                PlanStore(FakePlanApi(), cache),
                unusedFocusTests(cache),
            )
        val read = TodayRead.Day(today, today.session.toDayView())
        val onboarding =
            unfinished?.let { prompt ->
                val api = FakeOnboardingApi()
                api.resume =
                    ApiJson.decodeFromString(
                        """{"resume":{"kind":"draft","draftId":"5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d99","prompt":"$prompt"}}""",
                    )
                OnboardingStore(api, cache, FakeSession(ana)) { SignInResult.SignedIn }
            }

        rule.setContent {
            ZoonkTheme {
                Surface {
                    if (paused && onboarding != null) {
                        GoalAtRestPage(
                            goal = null,
                            completedLessons = false,
                            viewModel = viewModel,
                            today = store,
                            mocks = MockStore(FakeMockApi(null), cache),
                            padding = PaddingValues(),
                            navigate = {},
                            banner = { UnfinishedGoal(onboarding) {} },
                        )
                        return@Surface
                    }
                    TodayDay(
                        read,
                        store.today,
                        false,
                        viewModel,
                        rememberAppNavigator(),
                        PaddingValues(),
                        buddy = BuddyLook(),
                        buddyName = "Zu",
                        snackbars = AppSnackbars(),
                        refreshIfChanged = { false },
                        onboarding = onboarding,
                        schedule =
                            if (schedule) {
                                MockScheduleStore(
                                    ApiClients("http://localhost:1/".toHttpUrl(), OkHttpClient()),
                                    cache,
                                ) { "UTC" }
                            } else {
                                null
                            },
                    )
                }
            }
        }
        rule.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, rule.onRoot().captureRender().asAndroidBitmap())
    }

    private fun sessionBar(session: JsonObject): JsonObject {
        val statuses = session.getValue("blocks").jsonArray.map { it.jsonObject["status"]?.jsonPrimitive?.content }
        return buildJsonObject {
            put("completed", statuses.count { it == "completed" })
            put("total", statuses.count { it != "skipped" })
        }
    }

    private fun day(
        state: String,
        blocks: List<JsonObject> = emptyList(),
        next: Int? = null,
        left: Int = 20,
        done: Int = 0,
        dailyGoal: Int = 20,
        fields: List<Pair<String, Any?>> = emptyList(),
    ): JsonObject =
        fixture(
            "study-session",
            "id" to SESSION,
            "status" to if (state == "done") "completed" else "active",
            "state" to state,
            "blocks" to JsonArray(blocks),
            "nextPosition" to next,
            "minutes" to
                buildJsonObject {
                    put("dailyGoal", dailyGoal)
                    put("left", left)
                    put("done", done)
                    put("planned", dailyGoal)
                },
            *fields.toTypedArray(),
        )

    private fun block(
        position: Int,
        kind: String,
        vararg fields: Pair<String, Any?>,
    ) = fixture(
        "study-block",
        "id" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d${40 + position}",
        "position" to position,
        "kind" to kind,
        "screen" to if (kind == "learn") "lesson" else "session",
        *fields,
    )

    private fun lesson(
        position: Int,
        title: String,
        vararg fields: Pair<String, Any?>,
    ) = block(
        position,
        "learn",
        "title" to title,
        "lessonId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d${60 + position}",
        "estimatedMinutes" to 6,
        *fields,
    )

    /** A written exam's day: the 30-line question among the lessons, with its real time, and a drill that waits for tomorrow. */
    private fun written() =
        Day(
            day(
                "underway",
                listOf(
                    block(
                        0,
                        "review",
                        "status" to "completed",
                        "estimatedMinutes" to 10,
                        "questions" to 12,
                        "subject" to "Public administration",
                    ),
                    block(
                        1,
                        "produce",
                        "screen" to "essay",
                        "title" to "Write the 30-line question",
                        "subject" to "Written test",
                        "estimatedMinutes" to 70,
                    ),
                    lesson(2, "Budget expenses by nature", "subject" to "Public finance"),
                    lesson(3, "Kinds of government audit", "subject" to "Government auditing"),
                    block(
                        4,
                        "produce",
                        "screen" to "essay",
                        "title" to "Answer in a 10-line paragraph",
                        "subject" to "Written test",
                        "estimatedMinutes" to 8,
                        "writingUnit" to "drill",
                        "writingAvailability" to
                            buildJsonObject {
                                put("status", "tomorrow")
                                put("returnsOn", "2026-11-21")
                            },
                    ),
                ),
                next = 1,
                left = 225,
                done = 15,
                dailyGoal = 240,
            ),
        )

    private fun underway() =
        Day(
            day(
                "underway",
                listOf(
                    lesson(0, "How cells make energy", "status" to "completed", "subject" to "Biology"),
                    block(1, "review", "estimatedMinutes" to 4, "questions" to 6, "subject" to "Biology"),
                    lesson(2, "Photosynthesis step by step", "subject" to "Biology", "oftenTested" to true),
                    block(
                        3,
                        "practice",
                        "estimatedMinutes" to 5,
                        "topics" to JsonArray(listOf("Cell membranes", "Mitosis", "Osmosis").map(::JsonPrimitive)),
                    ),
                    lesson(4, "Genes and proteins", "subject" to "Genetics"),
                    block(
                        5,
                        "practice",
                        "estimatedMinutes" to 8,
                        "questions" to 10,
                        "title" to "Cell biology",
                        "checkpoint" to checkpoint(),
                        "waitReason" to "lessons",
                    ),
                    lesson(6, "DNA replication", "subject" to "Genetics"),
                    lesson(7, "Mendel's laws", "subject" to "Genetics"),
                ),
                next = 1,
                left = 32,
                done = 6,
                dailyGoal = 38,
            ),
        )

    /** A day that works on the learner's mistakes: their missed questions lead, then lessons that come back, then new ones. */
    private fun remedial(
        language: Boolean = false,
        oneSubject: Boolean = false,
        mistakesLeft: Int = 3,
    ) = Day(
        day(
            "underway",
            listOfNotNull(
                block(0, "practice", "screen" to "mistakesPractice", "estimatedMinutes" to mistakesLeft, "questions" to mistakesLeft),
                block(1, "review", "estimatedMinutes" to 4, "questions" to 6, "subject" to "Biology".takeUnless { language }),
                block(
                    5,
                    "practice",
                    "estimatedMinutes" to 5,
                    "subject" to "Biology",
                    "topics" to JsonArray(listOf("Cell membranes", "Mitosis", "Osmosis").map(::JsonPrimitive)),
                ).takeUnless { language },
                if (language) {
                    block(
                        2,
                        "practice",
                        "screen" to "pattern",
                        "patternId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d09",
                        "title" to "Gender of nouns",
                        "estimatedMinutes" to 3,
                    )
                } else {
                    lesson(2, "Photosynthesis step by step", "subject" to "Biology", "returning" to "again")
                },
                lesson(3, "Why cells divide", "returning" to "anotherWay").takeUnless { language },
                lesson(4, "Genes and proteins", "subject" to (if (oneSubject) "Biology" else "Genetics").takeUnless { language }),
            ),
            next = 0,
            left = 22,
            done = 0,
            dailyGoal = 22,
        ),
    )

    /** An exam day with a lesson of the exam strategy the learner added, which the notice doesn't list. */
    private fun strategy(document: String = "notice") =
        Day(
            day(
                "underway",
                listOf(
                    lesson(0, "Principles of public administration", "subject" to "Public administration"),
                    lesson(1, "How the exam is built", "subjectExtra" to "notice"),
                    lesson(2, "Conflicts of interest", "subject" to "Public ethics"),
                ),
                next = 0,
            ),
            today = listOf("goal" to examGoal(document)),
        )

    /** The plan followed the exam's notice by itself: Today names what left it. */
    private fun followedNotice(removed: List<String>) =
        Day(
            day("underway", listOf(lesson(0, "Principles of public administration", "subject" to "Public administration")), next = 0),
            today =
                listOf(
                    "goal" to examGoal("notice"),
                    "notice" to "planChange",
                    "planChange" to
                        fixture(
                            "plan-change",
                            "kind" to "noticeChanged",
                            "source" to "notice",
                            "status" to "applied",
                            "examDocument" to "notice",
                            "operations" to JsonArray(listOf(buildJsonObject { put("kind", "followNotice") })),
                            "effect" to
                                buildJsonObject {
                                    put("endDateAfter", null as String?)
                                    put("endDateBefore", null as String?)
                                    put("lessonsAdded", 0)
                                    put("lessonsRemoved", 120)
                                    put("noticeRemoved", JsonArray(removed.map(::JsonPrimitive)))
                                },
                        ),
                ),
        )

    private fun examGoal(document: String) =
        buildJsonObject {
            put("dateEstimated", false)
            put("daysLeft", 24)
            put("id", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
            put("kind", "exam")
            put("targetDate", "2026-12-15")
            put("title", "Câmara dos Deputados")
            put("displayName", "Câmara dos Deputados")
            put("examDocument", document)
        }

    private fun done() =
        Day(
            day(
                "done",
                listOf(
                    lesson(0, "How cells make energy", "status" to "completed"),
                    block(1, "review", "status" to "completed", "estimatedMinutes" to 4),
                ),
                left = 0,
                done = 22,
                fields = listOf("extraTime" to extraTime()),
            ),
        )

    private fun rest() =
        Day(
            day("rest", left = 0, dailyGoal = 0, fields = listOf("extraTime" to extraTime())),
        )

    private fun caughtUp(finished: Boolean = false) =
        Day(
            day("ahead", left = 0, fields = listOf("emptyDay" to "nothingNew", "extraTime" to extraTime(practice = true))),
            today = if (finished) listOf("progress" to progress(buildJsonObject { put("kind", "finished") })) else emptyList(),
        )

    private fun waiting() = Day(day("waiting", fields = listOf("lessonsComing" to true, "emptyDay" to "lessonsComing")))

    private fun prepare() = Day(day("prepare", fields = listOf("lessonsToPrepare" to true, "emptyDay" to "lessonsToPrepare")))

    private fun pastDate() =
        Day(
            day("rest", left = 0, dailyGoal = 0),
            today =
                listOf(
                    "progress" to
                        progress(
                            buildJsonObject {
                                put("kind", "pastDate")
                                put("lessons", 4)
                            },
                        ),
                ),
        )

    private fun earlierLessons() =
        Day(
            day(
                "underway",
                listOf(lesson(0, "How cells make energy"), block(1, "review", "estimatedMinutes" to 4)),
                next = 0,
                fields =
                    listOf(
                        "catchUp" to
                            buildJsonObject {
                                put("blockIds", JsonArray(emptyList()))
                                put("lessonsLeft", 3)
                                put("positions", JsonArray(emptyList()))
                                put(
                                    "later",
                                    buildJsonObject {
                                        put("lessons", 3)
                                        put("minutes", 25)
                                        put("offered", true)
                                    },
                                )
                            },
                    ),
            ),
        )

    private fun extraTime(practice: Boolean = false) =
        buildJsonObject {
            put("available", true)
            put("minutes", 10)
            put("reason", null as String?)
            put(
                "lessons",
                if (practice) {
                    JsonArray(emptyList())
                } else {
                    JsonArray(
                        listOf("Genes and proteins", "DNA replication").map { title ->
                            buildJsonObject {
                                put("title", title)
                                put("minutes", 6)
                            }
                        },
                    )
                },
            )
        }

    private fun progress(status: JsonObject) =
        buildJsonObject {
            put("measure", "preparation")
            put("status", status)
            put("value", 0.6)
            put("weekGain", 0.0)
        }

    /** A day whose mock exam is still to come, with the action to move it. */
    private fun mockExam() =
        Day(
            day(
                "underway",
                listOf(
                    lesson(0, "Cell membranes", "subject" to "Biology", "status" to "completed"),
                    lesson(1, "Mitosis and meiosis", "subject" to "Biology"),
                    block(
                        2,
                        "practice",
                        "estimatedMinutes" to 90,
                        "questions" to 45,
                        "title" to "Mock exam",
                        "planItemId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d90",
                        "checkpoint" to
                            buildJsonObject {
                                put("kind", "boss")
                                put("phase", 2)
                                put("rematch", false)
                                put("mock", true)
                                put(
                                    "mockIdentity",
                                    buildJsonObject {
                                        put("day", null as Int?)
                                        put("fullLength", true)
                                    },
                                )
                                put("passMark", 27)
                                put("timeLimitMinutes", 90)
                            },
                    ),
                ),
                next = 1,
                left = 96,
                done = 6,
                dailyGoal = 102,
            ),
        )

    private fun checkpoint() =
        buildJsonObject {
            put("kind", "boss")
            put("phase", 2)
            put("rematch", false)
            put("mock", false)
            put("passMark", 7)
            put("timeLimitMinutes", null as Int?)
        }

    private companion object {
        val ana = AuthenticatedSession("ana", "token-a", "local-a")
        const val SESSION = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d02"
        const val UNFINISHED_GOAL = "Learn enough Japanese to order food and ask for directions on my trip to Osaka in April"
    }
}
