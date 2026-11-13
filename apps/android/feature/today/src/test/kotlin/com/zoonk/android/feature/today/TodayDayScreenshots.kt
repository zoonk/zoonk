package com.zoonk.android.feature.today

import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
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
import com.zoonk.android.ui.theme.ZoonkTheme
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
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
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
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun underwayTablet() = render("today-underway-tablet", underway())

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

    private class Day(
        val session: JsonObject,
        val today: List<Pair<String, Any?>> = emptyList(),
    )

    private fun render(
        name: String,
        day: Day,
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

        rule.setContent {
            ZoonkTheme {
                Surface {
                    TodayDay(
                        read,
                        store.today,
                        false,
                        viewModel,
                        rememberAppNavigator(),
                        PaddingValues(),
                        buddy = BuddyLook(),
                        buddyName = "Zu",
                        refreshIfChanged = { false },
                    )
                }
            }
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
            day("ahead", left = 20, fields = listOf("emptyDay" to "nothingNew", "extraTime" to extraTime(practice = true))),
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
    }
}
