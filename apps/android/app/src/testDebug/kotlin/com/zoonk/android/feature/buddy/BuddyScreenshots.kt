package com.zoonk.android.feature.buddy

import android.graphics.Bitmap
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.WithTabRootBar
import com.zoonk.android.data.ANA
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.account
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.today.GoalMistakes
import com.zoonk.android.feature.tutor.BuddyConversation
import com.zoonk.android.feature.tutor.BuddyConversationList
import com.zoonk.android.feature.tutor.TutorAccess
import com.zoonk.android.feature.tutor.TutorThread
import com.zoonk.android.feature.tutor.TutorThreadKey
import com.zoonk.android.feature.tutor.TutorTurn
import com.zoonk.android.feature.tutor.turn
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BuddyFirstSteps
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearnerSummaryLevel
import com.zoonk.api.models.Memory
import com.zoonk.api.models.MistakeListAvailability
import kotlinx.coroutines.launch
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
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
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
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
    fun empty() = capture("buddy-empty", dark = false, turns = emptyList(), status = STATUS.copy(firstSteps = null), rows = emptyList())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun blankOnANewDay() = capture("buddy-blank-new-day", dark = false, current = null)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun listSheet() = capture("buddy-list-sheet", dark = false, sheet = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun listSheetDark() = capture("buddy-list-sheet-dark", dark = true, sheet = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun wideBlank() = capture("buddy-wide-blank", dark = false, current = null)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun wideMore() = capture("buddy-wide-more", dark = false, rows = MANY, more = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun wideAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("buddy-wide-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "pt-w411dp-h891dp-xxhdpi")
    fun phonePortuguese() = capture("buddy-phone-pt", dark = false)

    @Test
    @Config(qualifiers = "pt-w411dp-h891dp-xxhdpi")
    fun listSheetPortuguese() = capture("buddy-list-sheet-pt", dark = false, sheet = true)

    @Test
    @Config(qualifiers = "pt-w1280dp-h800dp-land-xhdpi")
    fun widePortuguese() = capture("buddy-wide-pt", dark = false, rows = MANY, more = true)

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = capture("buddy-medium", dark = false)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("buddy-book", dark = false, fold = true)

    @Test
    @Config(qualifiers = "pt-w411dp-h891dp-xxhdpi")
    fun daySheetPortuguese() = capture("buddy-day-sheet-pt", dark = false, day = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun daySheet() = capture("buddy-day-sheet", dark = false, day = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun daySheetDark() = capture("buddy-day-sheet-dark", dark = true, day = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun daySheetWide() = capture("buddy-day-sheet-wide", dark = false, day = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun daySheetWaiting() = capture("buddy-day-sheet-waiting", dark = false, status = STATUS.copy(firstSteps = WAITING), day = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun daySheetAllTried() = capture("buddy-day-sheet-all-tried", dark = false, status = STATUS.copy(firstSteps = ALL_TRIED), day = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun callsNoMissionsPhone() =
        capture("calls-no-missions-phone", dark = false, status = STATUS.copy(today = STATUS.today?.copy(missions = emptyList())))

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun callsNoMissionsLarge() =
        capture("calls-no-missions-large", dark = false, status = STATUS.copy(today = STATUS.today?.copy(missions = emptyList())))

    private fun capture(
        name: String,
        dark: Boolean,
        turns: List<TutorTurn> = TURNS,
        status: BuddyStatus = STATUS,
        rows: List<BuddyConversation> = ROWS,
        current: String? = rows.firstOrNull()?.id,
        sheet: Boolean = false,
        more: Boolean = false,
        day: Boolean = false,
        fold: Boolean = false,
    ) {
        // A signed-in learner, as only one gets the list: the session first, since a new session drops what was read before it.
        val app = AppContainer.preview(compose.activity, account = account(ANA))
        app.scope.launch { app.sessions.restore() }
        // The restore writes the learner's drafts' folder off the main thread before it signs in.
        repeat(RESTORE_TRIES) {
            shadowOf(Looper.getMainLooper()).idle()
            if (app.sessions.state.value is SessionState.SignedIn) return@repeat
            Thread.sleep(RESTORE_WAIT_MILLIS)
        }
        check(app.sessions.state.value is SessionState.SignedIn)
        compose.setContent {
            remember {
                app.apply {
                    buddy.status.replace(status)
                    learnerSummary.summary.replace(
                        learnerSummary().copy(level = LearnerSummaryLevel(LearnerSummaryLevel.Color.WHITE, 2)),
                    )
                    tutor.conversations[GOAL].replace(
                        BuddyConversationList(rows, current, nextCursor = if (more) CONVERSATION else null),
                    )
                    tutor.threads[
                        TutorThreadKey.Plan(
                            GOAL,
                            CONVERSATION,
                        ),
                    ].replace(TutorThread(turns, hasMore = false, nextCursor = null))
                    today.mistakes[UUID.fromString(GOAL)]
                        .replace(GoalMistakes(MistakeListAvailability(ready = 0), total = 1))
                    memory.memory.replace(Memory(enabled = true, facts = emptyList()))
                }
            }
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    WithTabRootBar(app, navigator) {
                        TabRootScaffold { padding ->
                            Box(
                                Modifier.padding(padding),
                            ) { BuddyPage(status, GOAL, AppRoute.Buddy(), app, navigator, access = TutorAccess.Ask) }
                        }
                    }
                }
            }
        }
        if (fold) unfold()
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        if (sheet) {
            compose.onNodeWithContentDescription(compose.activity.getString(R.string.buddy_page_conversations)).performClick()
            compose.waitForIdle()
            writeRender(file, compose.onNode(isDialog()).captureRender().asAndroidBitmap())
            return
        }
        if (day) {
            val buddy = status.buddy.name ?: compose.activity.getString(R.string.buddy_name_zu)
            compose
                .onNodeWithContentDescription(compose.activity.getString(R.string.buddy_page_energy_named, buddy), substring = true)
                .performClick()
            compose.waitForIdle()
            writeRender(file, compose.onNode(isDialog()).captureRender().asAndroidBitmap())
            return
        }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
        if (name.startsWith("calls-")) {
            compose
                .onNode(
                    SemanticsMatcher("opens Level") { it.config.getOrNull(SemanticsActions.OnClick)?.label == "Level" },
                ).assertExists()
        }
    }

    private fun unfold() =
        repeat(2) {
            compose.waitForIdle()
            folds.overrideWindowLayoutInfo(
                TestWindowLayoutInfo(
                    listOf(
                        FoldingFeature(
                            compose.activity,
                            state = FoldingFeature.State.FLAT,
                            orientation = FoldingFeature.Orientation.VERTICAL,
                        ),
                    ),
                ),
            )
        }

    private companion object {
        const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val BLOCK = "8c1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"

        const val CONVERSATION = "9d1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val RESTORE_TRIES = 100
        const val RESTORE_WAIT_MILLIS = 20L

        val ROWS by lazy {
            val now = Clock.System.now()
            listOf(
                BuddyConversation(CONVERSATION, "I want to study less this week", now),
                BuddyConversation("a1", "Why does the membrane let water through but not salt?", now - 1.days),
                BuddyConversation("a2", "Can we swap Friday's lesson for a review?", now - 3.days),
            )
        }

        val MANY by lazy {
            val now = Clock.System.now()
            ROWS + (4..12).map { BuddyConversation("b$it", "What should I review before my mock on chapter $it?", now - it.days) }
        }

        val TURNS by lazy {
            val now = Clock.System.now()
            listOf(
                turn("q1", TutorTurn.Status.Completed, "Today you're learning **cell membranes**, since they open the next topic.")
                    .copy(question = "Why am I studying this today?", createdAt = now - 1.days),
                turn("q2", TutorTurn.Status.Completed, "Sure: I made this week lighter. Take a look below.")
                    .copy(question = "I want to study less this week", createdAt = now),
            )
        }

        val WAITING: BuddyFirstSteps by lazy {
            ApiJson.decodeFromString(
                """
                {"done":0,"total":3,"steps":[
                  {"kind":"somethingNew","status":"today","opens":{"kind":"block","blockId":"$BLOCK"}},
                  {"kind":"challenge","status":"today","waitReason":"lessons","opens":{"kind":"block","blockId":"$BLOCK"}},
                  {"kind":"askBuddy","status":"available","opens":{"kind":"buddy"}}]}
                """.trimIndent(),
            )
        }

        val ALL_TRIED: BuddyFirstSteps by lazy {
            ApiJson.decodeFromString(
                """
                {"done":3,"total":3,"completedOn":"2026-10-29","steps":[
                  {"kind":"somethingNew","status":"done"},
                  {"kind":"askBuddy","status":"done"},
                  {"kind":"review","status":"done"}]}
                """.trimIndent(),
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
