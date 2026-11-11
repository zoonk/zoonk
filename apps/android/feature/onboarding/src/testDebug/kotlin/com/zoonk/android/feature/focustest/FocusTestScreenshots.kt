package com.zoonk.android.feature.focustest

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.onboarding.focusCheckpointOf
import com.zoonk.android.feature.onboarding.focusOf
import com.zoonk.android.feature.onboarding.focusOfferOf
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.NotToday
import com.zoonk.android.feature.questions.PlacementNote
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FocusTest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of an exam's Focus test with many subjects, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*FocusTestScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class FocusTestScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    fun invitation() = shoot("focus-test-invitation", FakeOnboardingApi().apply { placement = NOT_STARTED })

    /** The sheet draws in a dialog window these renders don't capture, so its rows render on their own. */
    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun invitationSubjects() = subjectsSheet("focus-test-invitation-subjects", asked = 0, answered = false)

    @Test
    fun question() = shoot("focus-test-question", startable(focusSittingOf(answered = 3))) { tap("Start the test") }

    @Test
    fun questionManyUnknown() =
        shoot("focus-test-question-many-unknown", startable(focusSittingOf(answered = 5, hint = "manyUnknown"))) { tap("Start the test") }

    @Test
    fun resume() = shoot("focus-test-resume", FakeOnboardingApi().apply { placement = RESUMING })

    @Test
    fun ended() =
        shoot(
            "focus-test-ended",
            FakeOnboardingApi().apply {
                placement = placementOf(next = null, focusTest = answered(focusSittingOf(answered = 15, subject = null, end = "settled")))
            },
        )

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpoint() = shoot("focus-test-checkpoint", closing(focusOf(), sessionQuestions = "on")) { tap("Use my answers") }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointFromImportance() =
        shoot("focus-test-checkpoint-importance", closing(focusOf(basis = "importance"), lessonsSkipped = 0)) { tap("Use my answers") }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointSubjects() = subjectsSheet("focus-test-checkpoint-subjects", asked = 6, answered = true)

    private fun subjectsSheet(
        name: String,
        asked: Int,
        answered: Boolean,
    ) {
        val test = ApiJson.decodeFromString<FocusTest>(focusTestOf(asked = asked))
        compose.setContent {
            ZoonkTheme {
                Surface {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(stringResource(R.string.focustest_subjects), style = MaterialTheme.typography.titleLarge)
                        SubjectsList(test.subjects, answered)
                    }
                }
            }
        }
        write(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanWithProposal() =
        shoot("focus-test-checkpoint-plan-proposal", closing(focusOf(state = "proposed", proposal = PROPOSAL)), host = FocusTestHost.Plan) {
            tap("Use my answers")
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanProposalApplied() =
        shoot(
            "focus-test-checkpoint-plan-proposal-applied",
            closing(focusOf(state = "proposed", proposal = PROPOSAL)),
            host = FocusTestHost.Plan,
        ) {
            tap("Use my answers")
            tap("Update my plan")
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanProposalNotNow() =
        shoot(
            "focus-test-checkpoint-plan-proposal-not-now",
            closing(focusOf(state = "proposed", proposal = PROPOSAL)),
            host = FocusTestHost.Plan,
        ) {
            tap("Use my answers")
            tap("Not now")
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanHandPicked() =
        shoot("focus-test-checkpoint-plan-hand-picked", closing(focusOf(state = "handPicked")), host = FocusTestHost.Plan) {
            tap("Use my answers")
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanDeclined() =
        shoot("focus-test-checkpoint-plan-declined", closing(focusOf(state = "declined")), host = FocusTestHost.Plan) {
            tap("Use my answers")
        }

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun checkpointOnPlanSuggested() =
        shoot("focus-test-checkpoint-plan-suggested", closing(focusOf(state = "suggested")), host = FocusTestHost.Plan) {
            tap("Use my answers")
        }

    /** Over an exam's test question inside a session; the second one after "Not today" didn't save. */
    @Test
    fun sessionNote() {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(48.dp)) {
                        PlacementNote(notToday = NotToday(failed = false) {})
                        PlacementNote(notToday = NotToday(failed = true) {})
                        PlacementNote()
                    }
                }
            }
        }
        write("focus-test-session-note")
    }

    private fun tap(text: String) {
        compose.onNodeWithText(text).performScrollTo().performClick()
        compose.waitForIdle()
    }

    private fun shoot(
        name: String,
        api: FakeOnboardingApi,
        host: FocusTestHost = FocusTestHost.Onboarding,
        steps: () -> Unit = {},
    ) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val cache = remember { AppCache(FakeSession(SESSION), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
                    val store = remember { OnboardingStore(api, cache, FakeSession(SESSION)) { SignInResult.SignedIn } }
                    val plans = remember { PlanStore(FakePlanApi(), cache) }
                    Page {
                        FocusTestFlow(
                            GOAL_ID,
                            host,
                            subject = "Federal Court Analyst",
                            store,
                            plans,
                            GenerationRun(),
                            onRetryRun = null,
                            onProgress = {},
                            onDone = { WriteOutcome.Done(Unit) },
                            onChangeFocus = if (host == FocusTestHost.Plan) ({}) else null,
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        steps()
        write(name)
    }

    private fun write(name: String) {
        compose.waitForIdle()
        // An open sheet draws in its own window over the page's.
        val bitmap =
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureRender()
                .asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    @androidx.compose.runtime.Composable
    private fun Page(content: @androidx.compose.runtime.Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val height = maxHeight
            Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .heightIn(min = height)
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                    content = content,
                )
            }
        }
    }

    private companion object {
        val SESSION = AuthenticatedSession("ana", "token-a", "local-a")

        const val QUESTION =
            """
            {"context":null,"image":null,"itemId":"2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182","skillId":"5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f",
             "visual":null,"format":"trueFalse","options":null,"question":"An administrative act is presumed lawful until it is shown otherwise."}
            """

        val NOT_STARTED = placementOf(next = null, focusTest = focusTestOf())

        fun answered(sitting: String) = focusTestOf(asked = 6, sitting = sitting, offer = null, checkpoint = focusCheckpointOf())

        val RESUMING = placementOf(next = QUESTION.trimIndent(), focusTest = answered(focusSittingOf(answered = 6)))

        /** Start opens [sitting] on its next question. */
        fun startable(sitting: String) =
            FakeOnboardingApi().apply {
                placement = NOT_STARTED
                this.sitting =
                    { placementOf(next = QUESTION.trimIndent(), focusTest = focusTestOf(asked = 3, sitting = sitting, offer = null)) }
            }

        /** "Use my answers" on the resume screen closes the sitting with [focus] as its result. */
        fun closing(
            focus: String,
            lessonsSkipped: Int = 14,
            sessionQuestions: String = "off",
        ) = FakeOnboardingApi().apply {
            placement = RESUMING
            completion =
                completionOf(
                    focusTestOf(
                        asked = 6,
                        offer = focusOfferOf(kind = "continuation", questions = 10),
                        checkpoint = focusCheckpointOf(lessonsSkipped, focus),
                        sessionQuestions = sessionQuestions,
                    ),
                )
        }

        /** A focus on two subjects: the second gains a lesson but starts later, since the first takes its slot. */
        const val PROPOSAL =
            """
            {"behind":null,"canApply":true,"canUndo":true,"createdAt":"2026-11-11T12:00:00.000Z","days":null,
             "effect":{"endDateAfter":"2026-12-10","endDateBefore":"2026-12-10","lessonsAdded":0,"lessonsRemoved":2,
              "areaStarts":[{"area":"Mathematics","after":"2026-11-20","before":"2026-11-17"}],
              "areaEnds":[{"area":"Administrative law","after":"2026-11-28","before":"2026-11-27","lessonsGained":1},
               {"area":"Mathematics","after":"2026-12-02","before":"2026-11-28","lessonsGained":1}]},
             "examDocument":"guide","id":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d01","kind":"edited","lessonsSkipped":0,"officialDate":null,
             "operations":[{"kind":"focusAreas","areas":["Administrative law","Mathematics"]}],"reason":null,"seen":false,
             "source":"focusTest","status":"proposed","todaySession":null}
            """
    }
}
