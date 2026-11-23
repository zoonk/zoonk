package com.zoonk.android.feature.buddy

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.ShellTestHost
import com.zoonk.android.app.everyPlace
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LearnerSummaryMissions
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
 * Review screenshots of the Buddy tab's face and missions ring,
 * written only on demand: `-Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class BuddyTabScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h900dp-xxhdpi")
    fun tabStates() = captureTabStates("buddy-tab-states", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h900dp-night-xxhdpi")
    fun tabStatesDark() = captureTabStates("buddy-tab-states-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun tabStatesAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureTabStates("buddy-tab-states-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun shellBar() = captureShell("buddy-tab-shell-bar")

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun shellRail() = captureShell("buddy-tab-shell-rail")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun shellDrawer() = captureShell("buddy-tab-shell-drawer")

    private fun captureTabStates(
        name: String,
        dark: Boolean,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    Column(Modifier.padding(vertical = 16.dp)) {
                        TAB_STATES.forEach { (label, buddy, missions) ->
                            Text(label, Modifier.padding(16.dp), style = MaterialTheme.typography.labelMedium)
                            NavigationBar {
                                listOf(false, true).forEach { selected ->
                                    NavigationBarItem(
                                        selected = selected,
                                        onClick = {},
                                        icon = { BuddyTabIcon(buddy, missions) },
                                        label = { Text("Pip") },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        save(name)
    }

    private fun captureShell(name: String) {
        compose.setContent {
            ZoonkTheme { ShellTestHost(everyPlace.copy(buddy = buddy(LearnerSummaryBuddy.Kind.NOODLE), missions = missions(2, 3))) }
        }
        save(name)
    }

    private fun save(name: String) {
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }

    private companion object {
        fun buddy(
            kind: LearnerSummaryBuddy.Kind,
            energy: Double? = 50.0,
            belt: LearnerSummaryBuddy.BeltColor = LearnerSummaryBuddy.BeltColor.BLUE,
        ) = everyPlace.buddy.copy(kind = kind, energy = energy, beltColor = belt, name = "Pip")

        fun missions(
            done: Long,
            total: Long,
        ) = LearnerSummaryMissions(done = done, total = total)

        val TAB_STATES: List<Triple<String, LearnerSummaryBuddy, LearnerSummaryMissions?>> =
            listOf(
                Triple("No missions today", buddy(LearnerSummaryBuddy.Kind.ZU), null),
                Triple("0 of 3", buddy(LearnerSummaryBuddy.Kind.NOODLE), missions(0, 3)),
                Triple("2 of 3", buddy(LearnerSummaryBuddy.Kind.BEEP), missions(2, 3)),
                Triple("3 of 3", buddy(LearnerSummaryBuddy.Kind.OTTO), missions(3, 3)),
                Triple(
                    "1 of 1, a white-belt baby",
                    buddy(LearnerSummaryBuddy.Kind.ZU, belt = LearnerSummaryBuddy.BeltColor.WHITE),
                    missions(1, 1),
                ),
                Triple("0 of 5, napping", buddy(LearnerSummaryBuddy.Kind.NOODLE, energy = 10.0), missions(0, 5)),
            )
    }
}
