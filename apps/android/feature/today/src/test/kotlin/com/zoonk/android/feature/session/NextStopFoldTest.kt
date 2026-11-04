package com.zoonk.android.feature.session

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class NextStopFoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun unfold() {
        folds.unfoldBook(rule.activity, rule::waitForIdle)
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun aGuessWhileTheLessonIsWrittenStaysAsTheBookOpensAndCloses() {
        val restoration = StateRestorationTester(rule)
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api = FakeStudyApi()
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }),
                StudySessionStore(api, cache) { "UTC" },
                { _, _ -> },
                cache,
                readiness = { _, _ ->
                    LessonReadiness(
                        alternative = null,
                        generationId = "run-1",
                        setAside = false,
                        status = LessonReadiness.Status.GENERATING,
                        warmUpId = UUID.fromString(WARM_UP_ID),
                    )
                },
                generations = {
                    object : GenerationSource {
                        override fun events(id: String) = flow<GenerationEvent> { awaitCancellation() }

                        override suspend fun status(id: String) = Generation.Status.RUNNING
                    }
                },
                now = { rule.mainClock.currentTime },
            )
        val waiting = step(0, screen = StudyBlock.Screen.SESSION, lessonId = LESSON)
        restoration.setContent {
            ZoonkTheme {
                NextStop(
                    viewModel = viewModel,
                    day = day(steps = listOf(waiting)),
                    step = waiting,
                    goalId = GOAL,
                    asked = true,
                    notWritten = null,
                    alternative = null,
                    refresh = {},
                    onStop = null,
                    navigator = rememberAppNavigator(),
                    warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session),
                )
            }
        }
        rule.waitForIdle()
        rule.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()

        unfold()
        val answer = rule.onNodeWithText("Here's the answer").getUnclippedBoundsInRoot()
        assertTrue("the guessed card is on the page after the fold: $answer", answer.left >= 426.dp)

        // Android recreates the screen as the book folds; window-testing tells the new one of no fold, so it's one column.
        restoration.emulateSavedInstanceStateRestore()
        rule.onNodeWithText("Here's the answer").assertExists()

        unfold()
        rule.onNodeWithText("Here's the answer").assertExists()
    }

    private companion object {
        val LESSON: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f00")
    }
}
