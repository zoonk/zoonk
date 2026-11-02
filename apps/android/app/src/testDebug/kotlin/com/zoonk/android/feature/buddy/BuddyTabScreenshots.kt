package com.zoonk.android.feature.buddy

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.ShellTestHost
import com.zoonk.android.app.everyPlace
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.EarlierQuestions
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LearnerSummaryMissions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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

/**
 * Review screenshots of the Buddy tab's face and missions ring and of the earlier questions page,
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

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun earlierQuestions() = captureEarlierQuestions("earlier-questions", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-night-xxhdpi")
    fun earlierQuestionsDark() = captureEarlierQuestions("earlier-questions-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h3200dp-xxhdpi")
    fun earlierQuestionsAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureEarlierQuestions("earlier-questions-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun earlierQuestionsWide() = captureEarlierQuestions("earlier-questions-wide", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun earlierQuestionsEmpty() =
        captureEarlierQuestions("earlier-questions-empty", dark = false) {
            first = EarlierQuestions(nextCursor = null, questions = emptyList())
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun earlierQuestionsFailed() =
        captureEarlierQuestions("earlier-questions-failed", dark = false) { firstFailure = ApiException(ApiError.Network) }

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

    private fun captureEarlierQuestions(
        name: String,
        dark: Boolean,
        setUp: FakeEarlierQuestionsApi.() -> Unit = {},
    ) {
        val api =
            FakeEarlierQuestionsApi().apply {
                first =
                    EarlierQuestions(
                        nextCursor = UUID(0, 3),
                        questions =
                            listOf(
                                earlierQuestion(
                                    1,
                                    answer = IONIC_ANSWER,
                                    courseTitle = "Chemistry basics",
                                    lessonTitle = "Ionic bonds",
                                ).copy(question = "Why does salt dissolve in water but not in oil?"),
                                earlierQuestion(2, answer = null, courseTitle = null, lessonTitle = "Covalent bonds")
                                    .copy(question = "Is a covalent bond stronger?"),
                                earlierQuestion(3, courseTitle = null, lessonTitle = null).copy(question = "What's an electron shell?"),
                            ),
                    )
                setUp()
            }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = EarlierQuestionsStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main)), session)

        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            ZoonkTheme(darkTheme = dark) { EarlierQuestionsScreen(app, rememberAppNavigator(), store) }
        }
        save(name)
    }

    private fun save(name: String) {
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use {
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
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

        const val IONIC_ANSWER =
            "An **ionic bond** forms when one atom gives an electron to another. See [your plan](https://www.zoonk.com/plan)."

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
