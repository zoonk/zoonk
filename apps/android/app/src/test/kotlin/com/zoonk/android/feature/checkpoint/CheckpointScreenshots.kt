package com.zoonk.android.feature.checkpoint

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.studyFeedback
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the checkpoint duel, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*CheckpointScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CheckpointScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun show(
        name: String,
        checkpoint: Checkpoint = checkpoint(),
        feedback: (StudyAnswerInput) -> StudyAnswerFeedback = { studyFeedback(isCorrect = true) },
        play: () -> Unit = {},
    ) {
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = checkpoint

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ) = feedback(input)

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
        val viewModel = CheckpointViewModel(checkpoint.blockId, CheckpointStore(api, cache) { "UTC" })
        runBlocking { viewModel.checkpoint.load() }
        viewModel.begin((viewModel.checkpoint.state.value as LoadState.Loaded).value)

        rule.setContent {
            ZoonkTheme {
                val duel by viewModel.duel.collectAsStateWithLifecycle()
                duel?.let {
                    val app = AppContainer.preview(rule.activity)
                    if (it.state.showsResult) DuelResult(it, viewModel, app) else DuelPlay(it, viewModel, app)
                }
            }
        }
        play()
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun confirm() {
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Confirm").performClick()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneDuel() = show("phone-duel")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWrong() = show("phone-wrong", feedback = { studyFeedback(isCorrect = false) }, play = ::confirm)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLost() =
        show("phone-lost", checkpoint(duelQuestion(Q1, answered = false), duelQuestion(Q2), duelQuestion(Q3)), feedback = {
            studyFeedback(isCorrect = false)
        }, play = ::confirm)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRight() = show("tablet-right", play = ::confirm)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWeekly() = show("phone-weekly", checkpoint(kind = "weekly"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultLostEarlier() =
        show(
            "phone-result-lost",
            checkpoint(
                fields =
                    arrayOf(
                        "status" to "completed",
                        "retry" to "tomorrow",
                        "reinforcementLessons" to 2,
                        "result" to
                            kotlinx.serialization.json.JsonObject(
                                mapOf(
                                    "correct" to kotlinx.serialization.json.JsonPrimitive(1),
                                    "passed" to kotlinx.serialization.json.JsonPrimitive(false),
                                    "total" to kotlinx.serialization.json.JsonPrimitive(3),
                                ),
                            ),
                    ),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResultWon() =
        show(
            "phone-result-won",
            checkpoint(
                fields =
                    arrayOf(
                        "status" to "completed",
                        "result" to
                            JsonObject(mapOf("correct" to JsonPrimitive(2), "passed" to JsonPrimitive(true), "total" to JsonPrimitive(3))),
                        "nextPhase" to JsonObject(mapOf("index" to JsonPrimitive(1), "name" to JsonPrimitive("Energy"))),
                        "reward" to
                            JsonObject(
                                mapOf(
                                    "badge" to JsonPrimitive(true),
                                    "brainPower" to JsonPrimitive(30),
                                    "glasses" to kotlinx.serialization.json.JsonNull,
                                    "phaseComplete" to JsonPrimitive(true),
                                ),
                            ),
                    ),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAnswerNotSaved() =
        show("phone-not-saved", feedback = {
            throw com.zoonk.android.data
                .ApiException(com.zoonk.android.data.ApiError.Network)
        }, play = ::confirm)
}
