package com.zoonk.android.feature.session

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.TodayGoal
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the session summary, on demand: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SessionSummaryScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h900dp-xxhdpi")
    fun phone() = capture("phone", rewardsStep = true)

    @Test
    @Config(qualifiers = "w411dp-h900dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", rewardsStep = true)

    @Test
    @Config(qualifiers = "w1000dp-h800dp-xhdpi")
    fun wide() = capture("wide", rewardsStep = false)

    @Test
    @Config(qualifiers = "w700dp-h900dp-xhdpi")
    fun medium() = capture("medium", rewardsStep = true)

    @Test
    @Config(qualifiers = "w411dp-h900dp-xxhdpi", fontScale = 2f)
    fun phoneLargeText() = capture("phone-large-text", rewardsStep = true)

    private fun capture(
        name: String,
        rewardsStep: Boolean,
    ) {
        val states = listOf("done" to (earned to false), "stopped" to (stopped to true))
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = name.endsWith("dark")) {
                CelebrationScope(play = false) {
                    key(index) {
                        val (summary, isStopped) = states[index].second
                        SessionSummary(
                            summary = summary,
                            facts = SummaryFacts(stopped = isStopped, goalKind = TodayGoal.Kind.EXAM, bonus = 50, guest = isStopped),
                            buddy = BuddyLook(),
                            buddyName = "Zu",
                            busy = null,
                            failed = null,
                            actions = SummaryActions({}, {}, {}, {}, {}),
                        )
                    }
                }
            }
        }
        states.indices.forEach { state ->
            index = state
            compose.waitForIdle()
            write("session-summary-${states[state].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }
        if (rewardsStep) {
            index = 0
            compose.waitForIdle()
            compose.onNodeWithText("Continue").performClick()
            compose.waitForIdle()
            write("session-summary-rewards-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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
        val yellow =
            JsonObject(
                mapOf(
                    "bpPerLevel" to 100.toJson(),
                    "bpToNextLevel" to 40.toJson(),
                    "color" to "yellow".toJson(),
                    "isMaxLevel" to false.toJson(),
                    "level" to 4.toJson(),
                    "progressInLevel" to 60.toJson(),
                ),
            )

        fun mission() =
            JsonObject(
                mapOf(
                    "done" to 1.toJson(),
                    "kind" to "review".toJson(),
                    "status" to "done".toJson(),
                    "total" to 1.toJson(),
                ),
            )

        fun move(
            name: String,
            from: String,
            to: String,
        ) = JsonObject(
            mapOf(
                "from" to from.toJson(),
                "name" to name.toJson(),
                "skillId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d0${name.length % 10}".toJson(),
                "to" to to.toJson(),
            ),
        )

        val earned: StudySessionSummary =
            decodeFixture(
                "study-session-summary",
                "belt" to
                    JsonObject(
                        mapOf("after" to yellow, "before" to yellow, "colorChanged" to false.toJson(), "stripesGained" to 1.toJson()),
                    ),
                "bestStreak" to 6,
                "comesBack" to JsonArray(listOf(JsonObject(mapOf("date" to "2026-11-02".toJson(), "skills" to 3.toJson())))),
                "extraTime" to
                    JsonObject(
                        mapOf(
                            "available" to true.toJson(),
                            "lessons" to JsonArray(emptyList()),
                            "minutes" to 10.toJson(),
                            "reason" to null.toJson(),
                        ),
                    ),
                "fullMeal" to true,
                "missions" to JsonArray(listOf(mission(), mission(), mission())),
                "mistakesSaved" to 2,
                "netScore" to 6,
                "preparation" to JsonObject(mapOf("after" to 0.42.toJson(), "before" to 0.38.toJson())),
                "skillsMoved" to JsonArray(listOf(move("Fractions", "learning", "solid"), move("Ratios", "new", "learning"))),
                "tomorrow" to JsonObject(mapOf("title" to "Proportions and scale".toJson())),
            )

        val stopped: StudySessionSummary =
            decodeFixture("study-session-summary", "finished" to false, "minutes" to 7, "mistakesSaved" to 1, "status" to "active")
    }
}
