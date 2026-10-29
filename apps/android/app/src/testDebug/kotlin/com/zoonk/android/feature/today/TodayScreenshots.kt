package com.zoonk.android.feature.today

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageTodaySpeaking
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Today
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of Today's day states, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*TodayScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TodayScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun foldUnfolded() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    @Test
    @Config(qualifiers = "w1280dp-h1600dp-xhdpi")
    fun tabletAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("tablet-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h2000dp-xhdpi")
    fun mediumAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("medium-font200")
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                key(index) { Screen(DAYS[index].second) }
            }
        }
        DAYS.indices.forEach { day ->
            index = day
            compose.waitForIdle()
            write("today-${DAYS[day].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    @Composable
    private fun Screen(read: TodayRead.Day) {
        val context = LocalContext.current
        val app = remember { AppContainer.preview(context) }
        val navigator = rememberAppNavigator()
        val viewModel = viewModel { TodayViewModel(app.studyOpener, app.today, app.plans) }

        TabRootScaffold(app, navigator) { padding ->
            TodayDay(
                read,
                app.today.today,
                false,
                viewModel,
                navigator,
                padding,
                buddy =
                    com.zoonk.android.ui.characters
                        .BuddyLook(),
                buddyName = "Zu",
                brainPower = 1240,
                practice = { TodayPracticeRows(MistakeListAvailability(ready = 3, tomorrow = 1), MOCKS, SPEAKING, navigate = {}) },
            )
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
        val MOCKS: MockOptions by lazy {
            decodeFixture<MockOptions>(
                "mock-options",
                "access" to "plusRequired",
                "options" to JsonArray(listOf(fixture("mock-option", "kind" to "area", "area" to "Biologia"))),
            )
        }

        val SPEAKING = LanguageTodaySpeaking(access = LanguageTodaySpeaking.Access.PLUS_REQUIRED, title = "IELTS")

        val DAYS: List<Pair<String, TodayRead.Day>> by lazy {
            listOfNotNull(
                // A real read saved as `today.json` in the shots folder (GET /v1/today) renders first.
                File(System.getProperty("zoonk.shots").orEmpty(), "today.json").takeIf { it.isFile }?.let { file ->
                    val read =
                        com.zoonk.api.ApiJson
                            .decodeFromString<Today>(file.readText())
                    "real" to TodayRead.Day(read, read.session.toDayView())
                },
                "unopened" to unopened(),
                "started" to started(),
                "notice-exam" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        today =
                            mapOf(
                                "exam" to
                                    fixture(
                                        "exam-moment",
                                        "stage" to "dayBefore",
                                        "dayBefore" to "review",
                                        "examName" to "ENEM",
                                        "sessionsDone" to 41,
                                        "mocksTaken" to 3,
                                        "prepared" to true,
                                        "day" to
                                            buildJsonObject {
                                                put("date", "2026-11-08")
                                                put("label", null as String?)
                                                put("startTime", "13:30")
                                            },
                                        "checklist" to
                                            JsonArray(
                                                listOf("documents", "blackPen", "route", "sleep").map {
                                                    kotlinx.serialization.json.JsonPrimitive(it)
                                                },
                                            ),
                                        "tools" to
                                            JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive("A black pen with a clear barrel"))),
                                    ),
                            ),
                    ),
                "notice-exam-choice" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        today =
                            mapOf(
                                "examChoice" to
                                    buildJsonObject {
                                        put("group", "Língua estrangeira")
                                        put(
                                            "options",
                                            buildJsonArray {
                                                listOf("Inglês", "Espanhol").forEach { name ->
                                                    add(
                                                        buildJsonObject {
                                                            put("name", name)
                                                            put("shortName", null as String?)
                                                        },
                                                    )
                                                }
                                            },
                                        )
                                        put("subject", null as String?)
                                    },
                            ),
                    ),
                "notice-insight" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        today =
                            mapOf(
                                "insight" to
                                    fixture(
                                        "memory-insight",
                                        "kind" to "scheduleIdea",
                                        "message" to "You get more right in the evening. Studying around 7 PM could help.",
                                        "studyTime" to "7:00 PM",
                                    ),
                            ),
                    ),
                "notice-access" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        extra =
                            mapOf(
                                "examAccess" to
                                    buildJsonObject {
                                        put("includesMockExams", false)
                                        put("trialEnded", true)
                                    },
                            ),
                    ),
                "short-plan" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        today =
                            mapOf(
                                "shortPlan" to
                                    buildJsonObject {
                                        put("day", 2)
                                        put("days", 5)
                                        put("focus", "mockAndReview")
                                        put("mockDate", null as String?)
                                    },
                            ),
                    ),
                "mock-funding" to
                    day(
                        blocks = lessons(3),
                        next = 0,
                        today =
                            mapOf(
                                "mockFunding" to
                                    buildJsonObject {
                                        put("mockDate", "2026-10-31")
                                        put("mockMinutes", 180)
                                        put("setAsideMinutes", 20)
                                    },
                            ),
                    ),
                "done-up-next" to doneWithUpNext(),
                "rest" to day(blocks = emptyList(), next = null, dailyGoal = 0),
                "waiting" to day(blocks = emptyList(), next = null, extra = mapOf("emptyDay" to "lessonsComing")),
                "limit" to day(blocks = lessons(4, done = 2), next = 2, extra = mapOf("dailyLimit" to limitReached())),
            )
        }

        fun block(
            position: Int,
            kind: String = "learn",
            title: String? = "Lesson ${position + 1}",
            status: String = "pending",
            minutes: Int = 6,
            extra: Map<String, Any?> = emptyMap(),
        ): JsonObject =
            fixture(
                "study-block",
                "id" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c%04d".format(position),
                "kind" to kind,
                "screen" to (if (kind == "learn") "lesson" else "session"),
                "lessonId" to (if (kind == "learn") "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3d%04d".format(position) else null),
                "position" to position,
                "status" to status,
                "title" to title,
                "estimatedMinutes" to minutes,
                "canDo" to (if (kind == "learn") "Explain how cells divide" else null),
                *extra.toList().toTypedArray(),
            )

        fun lessons(
            count: Int,
            done: Int = 0,
        ) = (0 until count).map { block(it, status = if (it < done) "completed" else "pending") }

        fun limitReached() =
            buildJsonObject {
                put("limitMinutes", 30)
                put("reached", true)
                put("remainingMinutes", 0)
                put("usedMinutes", 30)
            }

        fun day(
            blocks: List<JsonObject>,
            next: Int?,
            dailyGoal: Int = 45,
            unopened: Boolean = false,
            extra: Map<String, Any?> = emptyMap(),
            today: Map<String, Any?> = emptyMap(),
        ): TodayRead.Day {
            val minutes =
                buildJsonObject {
                    put("dailyGoal", dailyGoal)
                    put("done", 0)
                    put("planned", dailyGoal)
                }
            val week =
                buildJsonObject {
                    put(
                        "days",
                        buildJsonArray {
                            listOf(
                                Triple("2026-10-26", "study", 45),
                                Triple("2026-10-27", "study", 0),
                                Triple("2026-10-28", "study", 22),
                                Triple("2026-10-29", "study", 0),
                                Triple("2026-10-30", "study", 0),
                                Triple("2026-10-31", "study", 0),
                                Triple("2026-11-01", "rest", 0),
                            ).forEach { (date, kind, minutes) ->
                                add(
                                    buildJsonObject {
                                        put("date", date)
                                        put("goalMinutes", if (kind == "rest") 0 else dailyGoal)
                                        put("hitGoal", minutes >= dailyGoal && dailyGoal > 0)
                                        put("isToday", date == "2026-10-28")
                                        put("kind", kind)
                                        put("minutes", minutes)
                                        put("studied", minutes > 0)
                                    },
                                )
                            }
                        },
                    )
                    put("nextStudyDate", "2026-10-29")
                    putJsonObject("time") {
                        put("studiedMinutes", 80)
                        put("targetMinutes", 225)
                    }
                }
            val sessionBlocks = if (unopened) blocks.map { JsonObject(it - "id") } else blocks
            val session =
                fixture(
                    if (unopened) "unstarted-study-day" else "study-session",
                    "status" to if (unopened) "unstarted" else "active",
                    "blocks" to JsonArray(sessionBlocks),
                    "nextPosition" to next,
                    "minutes" to minutes,
                    "week" to week,
                    "goalId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01",
                    *extra.toList().toTypedArray(),
                )
            val goal =
                buildJsonObject {
                    put("dateEstimated", false)
                    put("daysLeft", 41)
                    put("id", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01")
                    put("kind", "exam")
                    put("targetDate", "2026-12-08")
                    put("title", "ENEM 2026")
                }
            val progress =
                buildJsonObject {
                    put("measure", "preparation")
                    put("status", buildJsonObject { put("kind", "onTrack") })
                    put("value", 0.42)
                    put("weekGain", 0.03)
                }
            val challenge =
                buildJsonObject {
                    put("access", "open")
                    put("date", "2026-10-31")
                    put("kind", "mixed")
                    put("planItemId", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d99")
                    put("questions", 12)
                    put("timeLimitMinutes", 20)
                    put("title", null as String?)
                }
            val read =
                decodeFixture<Today>(
                    "today",
                    "session" to session,
                    "goal" to goal,
                    "progress" to progress,
                    "weeklyChallenge" to challenge,
                    *today.toList().toTypedArray(),
                )
            return TodayRead.Day(read, read.session.toDayView())
        }

        fun capsules(): JsonElement =
            buildJsonArray {
                listOf("1.2 Cell membrane", "2 Mitosis", "Photosynthesis", "Genetics").forEach { title ->
                    add(
                        buildJsonObject {
                            put("format", "rapidFire")
                            put("key", title)
                            put("lessonId", null as String?)
                            put("opened", false)
                            put("questions", 3)
                            put("title", title)
                        },
                    )
                }
            }

        fun unopened() =
            day(
                blocks =
                    listOf(
                        block(0, kind = "review", title = null, minutes = 8, extra = mapOf("capsules" to capsules(), "questions" to 14)),
                    ) +
                        (1..7).map { block(it, extra = if (it == 2) mapOf("subject" to "Biologia") else emptyMap()) } +
                        block(
                            8,
                            kind = "checkpoint",
                            title = "Phase 1: Cells",
                            minutes = 10,
                            extra =
                                mapOf(
                                    "waitReason" to "lessons",
                                    "questions" to 12,
                                ),
                        ),
                next = 0,
                unopened = true,
                extra = mapOf("freshStart" to "newWeek", "lessonsComing" to true),
                today = mapOf("studiedToday" to false),
            )

        fun started() =
            day(
                blocks =
                    listOf(
                        block(
                            0,
                            kind = "review",
                            title = null,
                            status = "completed",
                            extra =
                                mapOf(
                                    "capsules" to capsules(),
                                    "questions" to 14,
                                ),
                        ),
                        block(1, status = "completed"),
                        block(2, status = "skipped"),
                        block(
                            3,
                            kind = "practice",
                            title = null,
                            status = "active",
                            minutes = 10,
                            extra =
                                mapOf(
                                    "questions" to 10,
                                    "answered" to 4,
                                ),
                        ),
                        block(4),
                        block(5),
                    ),
                next = 3,
                extra = mapOf("missions" to missions(), "fullMeal" to fullMeal()),
            )

        fun missions(): JsonElement =
            buildJsonArray {
                add(
                    buildJsonObject {
                        put("done", 1)
                        put("kind", "review")
                        put("status", "done")
                        put("total", 1)
                    },
                )
                add(
                    buildJsonObject {
                        put("done", 0)
                        put("kind", "somethingNew")
                        put("status", "todo")
                        put("total", 1)
                        put("minutes", 6)
                        putJsonObject("opens") {
                            put("kind", "block")
                            put("blockId", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c0004")
                        }
                    },
                )
                add(
                    buildJsonObject {
                        put("done", 1)
                        put("kind", "fixMistake")
                        put("status", "todo")
                        put("total", 3)
                        put("minutes", 4)
                        putJsonObject("opens") { put("kind", "mistakesPractice") }
                    },
                )
            }

        fun fullMeal() =
            buildJsonObject {
                put("bonus", 20)
                put("earned", false)
                put("ready", false)
            }

        fun doneWithUpNext(): TodayRead.Day {
            val extraTime =
                buildJsonObject {
                    put("available", true)
                    put(
                        "lessons",
                        buildJsonArray {
                            listOf("Meiosis" to 7, "Genetic code" to 6, "Proteins" to 8).forEach { (title, minutes) ->
                                add(
                                    buildJsonObject {
                                        put("minutes", minutes)
                                        put("title", title)
                                    },
                                )
                            }
                        },
                    )
                    put("minutes", 10)
                    put("reason", null as String?)
                }
            return day(blocks = lessons(3, done = 3), next = null, extra = mapOf("extraTime" to extraTime))
        }
    }
}
