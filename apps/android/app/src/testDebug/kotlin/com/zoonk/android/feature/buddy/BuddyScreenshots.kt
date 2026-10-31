package com.zoonk.android.feature.buddy

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.tutor.TutorAccess
import com.zoonk.android.feature.tutor.TutorThread
import com.zoonk.android.feature.tutor.TutorThreadKey
import com.zoonk.android.feature.tutor.TutorTurn
import com.zoonk.android.feature.tutor.turn
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.Memory
import com.zoonk.api.models.MistakeListAvailability
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
import kotlin.time.Clock
import kotlin.time.Duration.Companion.days

/** Review screenshots of the buddy tab with a conversation, its day and first steps: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class BuddyScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("buddy-phone", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("buddy-phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("buddy-phone-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun wide() = capture("buddy-wide", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun empty() = capture("buddy-empty", dark = false, turns = emptyList(), status = STATUS.copy(firstSteps = null))

    private fun capture(
        name: String,
        dark: Boolean,
        turns: List<TutorTurn> = TURNS,
        status: BuddyStatus = STATUS,
    ) {
        compose.setContent {
            val context = LocalContext.current
            val app =
                remember {
                    AppContainer.preview(context).apply {
                        buddy.status.replace(status)
                        learnerSummary.summary.replace(learnerSummary())
                        tutor.threads[TutorThreadKey.Plan(GOAL)].replace(TutorThread(turns, hasMore = false, nextCursor = null))
                        today.mistakes[UUID.fromString(GOAL)].replace(MistakeListAvailability(ready = 1, tomorrow = 0))
                        memory.memory.replace(Memory(enabled = true, facts = emptyList()))
                    }
                }
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    TabRootScaffold(app, navigator) { padding ->
                        Box(Modifier.padding(padding)) { BuddyPage(status, GOAL, ask = null, app, navigator, access = TutorAccess.Ask) }
                    }
                }
            }
        }
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
        const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val BLOCK = "8c1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"

        val TURNS by lazy {
            val now = Clock.System.now()
            listOf(
                turn("q1", TutorTurn.Status.Completed, "Today you're learning **cell membranes**, since they open the next topic.")
                    .copy(question = "Why am I studying this today?", createdAt = now - 1.days),
                turn("q2", TutorTurn.Status.Completed, "Sure: I made this week lighter. Take a look below.")
                    .copy(question = "I want to study less this week", createdAt = now),
            )
        }

        val STATUS: BuddyStatus by lazy {
            ApiJson.decodeFromString(
                """
                {"belt":{"bpPerLevel":100,"bpToNextLevel":40,"color":"white","isMaxLevel":false,"level":2,"progressInLevel":60,"totalBrainPower":160},
                 "buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},
                 "energy":{"current":64,"state":"awake","studiedToday":false},
                 "firstSteps":{"done":1,"total":4,"steps":[
                   {"kind":"somethingNew","status":"done"},
                   {"kind":"askBuddy","status":"available","opens":{"kind":"buddy"}},
                   {"kind":"review","status":"later","when":{"kind":"review"}},
                   {"kind":"challenge","status":"later","when":{"kind":"challenge","date":"2026-11-02"}}]},
                 "glasses":[{"current":1,"earned":true,"glasses":"round","target":1},{"current":2,"earned":false,"glasses":"star","target":7}],
                 "nextStage":{"belt":"yellow","brainPowerToGo":240,"stage":"young"},
                 "stage":"baby",
                 "thisWeek":{"fixes":0,"newIdeas":3,"reviews":1},
                 "today":{"fullMeal":{"bonus":30,"earned":false},"goalId":"$GOAL","localDate":"2026-10-29","missions":[
                   {"done":1,"kind":"somethingNew","status":"todo","total":2,"minutes":12,"opens":{"kind":"block","blockId":"$BLOCK"}},
                   {"done":0,"kind":"askBuddy","status":"todo","total":1,"opens":{"kind":"buddy"}}]}}
                """.trimIndent(),
            )
        }
    }
}
