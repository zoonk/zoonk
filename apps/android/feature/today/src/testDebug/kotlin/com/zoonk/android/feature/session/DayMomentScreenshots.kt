package com.zoonk.android.feature.session

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.missions.MissionMomentFacts
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MistakePatternPracticeResultReachedLevel
import com.zoonk.api.models.StudyMission
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the day moment's end state, on demand: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class DayMomentScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
    ) {
        val moments = listOf("one-done" to oneDone, "payoff" to payoff)
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    CelebrationScope(play = false) {
                        key(index) {
                            DayMoment(
                                missions = moments[index].second,
                                reached = ReachedFacts(level, energy = 80),
                                ceremony = null,
                                buddy = BuddyLook(),
                                buddyName = "Zu",
                                modifier = Modifier.padding(16.dp),
                            )
                        }
                    }
                }
            }
        }
        moments.indices.forEach { moment ->
            index = moment
            compose.waitForIdle()
            write("day-moment-${moments[moment].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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
        val level = MistakePatternPracticeResultReachedLevel(MistakePatternPracticeResultReachedLevel.Color.YELLOW, 4)

        fun mission(
            kind: StudyMission.Kind,
            done: Boolean,
            progress: Long = if (done) 1 else 0,
            total: Long = 1,
        ) = DayMission(kind, done, progress, total, minutes = 5.0, firstStep = false, waitReason = null, detail = null, opens = null)

        val oneDone =
            MissionMomentFacts(
                missions =
                    listOf(
                        mission(StudyMission.Kind.REVIEW, done = true),
                        mission(StudyMission.Kind.SOMETHING_NEW, done = false, progress = 1, total = 2),
                        mission(StudyMission.Kind.ESSAY, done = false),
                    ),
                completed = listOf(StudyMission.Kind.REVIEW),
                bonus = 50,
                bonusPaid = false,
            )

        val payoff =
            MissionMomentFacts(
                missions =
                    listOf(
                        mission(StudyMission.Kind.REVIEW, done = true),
                        mission(StudyMission.Kind.SOMETHING_NEW, done = true, progress = 2, total = 2),
                        mission(StudyMission.Kind.ESSAY, done = true),
                    ),
                completed = listOf(StudyMission.Kind.ESSAY),
                bonus = 50,
                bonusPaid = true,
            )
    }
}
