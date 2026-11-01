package com.zoonk.android.feature.checkpoint

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.studyFeedback
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** A duel on an unfolded book foldable: the Trickster and the question on the page before the fold, the answers after it. */
@RunWith(AndroidJUnit4::class)
class CheckpointSpreadTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show() {
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = checkpoint()

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ) = studyFeedback(isCorrect = true)

                override suspend fun finish(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    timeZone: String,
                ): StudyBlockCompletion = error("Not used")
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = CheckpointViewModel(checkpoint().blockId, CheckpointStore(api, cache) { "UTC" })
        runBlocking { viewModel.checkpoint.load() }
        viewModel.begin((viewModel.checkpoint.state.value as LoadState.Loaded).value)

        rule.setContent {
            ZoonkTheme {
                val duel by viewModel.duel.collectAsStateWithLifecycle()
                duel?.let { DuelPlay(it, viewModel, AppContainer.preview(rule.activity)) }
            }
        }
    }

    /** Opens the book flat, its fold down the middle of the window. */
    private fun unfold() {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun text(
        text: String,
        substring: Boolean = false,
    ): DpRect = rule.onNodeWithText(text, substring = substring, useUnmergedTree = true).getUnclippedBoundsInRoot()

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookShowsTheTricksterAndTheQuestionBeforeTheFoldAndTheAnswersAfterIt() {
        show()
        unfold()

        assertTrue("the shield ends before the fold", text("The Trickster's shield").right <= FOLD)
        assertTrue("the question ends before the fold", text("Which is a planet?").right <= FOLD)
        assertTrue("an option starts after the fold", text("Mars").left >= FOLD)

        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Confirm").performClick()
        rule.waitForIdle()

        assertTrue("the verdict starts after the fold", text("Correct!").left >= FOLD)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aTabletKeepsTheTricksterBesideOneColumn() {
        show()

        val question = text("Which is a planet?")
        val option = text("Mars")
        assertTrue("the options sit under the question", option.top > question.bottom)
        assertTrue("the shield sits beside the options", text("The Trickster's shield").left > option.right)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aPhoneKeepsTheQuestionAndItsAnswersInOneColumn() {
        show()

        val question = text("Which is a planet?")
        val option = text("Mars")
        assertTrue("the options sit under the question", option.top > question.bottom)
        rule.onNodeWithText("The Trickster's shield").assertDoesNotExist()
    }

    private companion object {
        val FOLD = 426.dp
    }
}
