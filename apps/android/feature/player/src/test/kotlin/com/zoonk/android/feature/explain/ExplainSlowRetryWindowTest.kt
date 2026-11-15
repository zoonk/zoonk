package com.zoonk.android.feature.explain

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Explanation
import com.zoonk.api.models.Generation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** A slow explanation's Try again follows the new run though the window changes width, both ways, while it asks. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class ExplainSlowRetryWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<ExplainSlowTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aTryAgainOutWhileTheWindowWidensAndNarrowsFollowsTheNewRunOnce() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = ExplainSlowTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val followed = mutableListOf<String>()
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api =
            object : ExplainApi {
                override suspend fun explanation(
                    session: AuthenticatedSession,
                    goalId: String,
                ) = SLOW_EXPLANATION

                override suspend fun writeAgain(
                    session: AuthenticatedSession,
                    goalId: String,
                ): String {
                    held.await()
                    return "gen-2"
                }
            }
        val source =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> = emptyFlow<GenerationEvent>().also { followed += id }

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        ExplainSlowTest.viewModel = ExplainViewModel(GOAL, ExplainStore(api, cache), cache, session, { source })
        ExplainSlowTest.viewModel.show(SLOW_EXPLANATION)
        ExplainSlowTest.explanation = SLOW_EXPLANATION
        scenario = ActivityScenario.launch(ExplainSlowTestActivity::class.java)
        rule.mainClock.advanceTimeBy(SLOW_MILLIS)

        rule.onNodeWithText("Try again").performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()
        rule.mainClock.advanceTimeBy(SLOW_MILLIS)

        assertEquals(listOf("gen-1", "gen-2"), followed)
        rule.onNodeWithText("Still getting your explanation ready.").assertExists()
        assertEquals(0, rule.onAllNodesWithText("Try again").fetchSemanticsNodes().size)
    }

    private companion object {
        const val GOAL = "00000000-0000-4000-8000-000000000031"
        const val SLOW_MILLIS = 46_000L
        val SLOW_EXPLANATION: Explanation =
            ApiJson.decodeFromString(
                Explanation.serializer(),
                """
                {"generationId":"gen-1","goFurther":{"course":null,"questions":[]},"goalId":"$GOAL","hasStudyGoal":false,"lesson":null,
                 "outline":[],"question":"Why is the sky blue?","recap":[],"status":"preparing","title":"Why is the sky blue?"}
                """.trimIndent(),
            )
    }
}

/** What outlives [ExplainSlowTestActivity]'s recreations, as a navigation entry's view models do. */
object ExplainSlowTest {
    lateinit var viewModel: ExplainViewModel
    lateinit var explanation: Explanation
}

class ExplainSlowTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val viewModel =
            ViewModelProvider(
                this,
                object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T = ExplainSlowTest.viewModel as T
                },
            )["explain", ExplainViewModel::class.java]
        setContent { ZoonkTheme { SlowWait(ExplainSlowTest.explanation, viewModel) } }
    }
}
