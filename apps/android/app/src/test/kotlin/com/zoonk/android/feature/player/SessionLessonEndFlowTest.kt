package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SessionLessonEndFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private val steps = FakeSessionSteps()

    private fun finish(sessionCompleted: Boolean = false) {
        harness.play(listOf(summaryStep("end")), sessionId = SESSION_ID, sessionSteps = steps) {
            completion = sessionCompletion(sessionCompleted)
        }
        harness.tap("Continue")
        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
    }

    @Test
    fun continueOpensTheSessionsNextStepAfterAFailedTry() {
        val next = AppRoute.Lesson("next-lesson", SESSION_ID)
        steps.nexts += MutationResult.Failed(ApiError.Network)
        steps.nexts += MutationResult.Done(next)
        finish()

        harness.tap("Continue")
        rule.onNodeWithText("We couldn't open the next step. Try again.").assertIsDisplayed()
        assertEquals(emptyList<AppRoute>(), harness.replaced)

        harness.tap("Continue")
        rule.waitUntil { harness.replaced.isNotEmpty() }
        assertEquals(listOf<AppRoute>(next), harness.replaced)
    }

    @Test
    fun stopForTodayOpensTheStoppedSession() {
        finish()

        harness.tap("Stop for today")
        rule.waitUntil { harness.replaced.isNotEmpty() }

        assertEquals(listOf(UUID.fromString(SESSION_ID)), steps.stops)
        assertEquals(listOf<AppRoute>(AppRoute.Session(sessionId = SESSION_ID, stopped = true)), harness.replaced)
    }

    @Test
    fun aFinishedSessionLeadsToItsSummary() {
        val summary = AppRoute.Session(sessionId = SESSION_ID)
        steps.nexts += MutationResult.Done(summary)
        finish(sessionCompleted = true)

        rule.onNodeWithText("Stop for today").assertDoesNotExist()
        harness.tap("See today's summary")
        rule.waitUntil { harness.replaced.isNotEmpty() }
        assertEquals(listOf<AppRoute>(summary), harness.replaced)
    }
}

private class FakeSessionSteps : SessionSteps {
    val nexts = ArrayDeque<MutationResult<AppRoute>>()
    val stops = mutableListOf<UUID>()

    override suspend fun continueSession(sessionId: UUID) = nexts.removeFirst()

    override suspend fun stop(sessionId: UUID): MutationResult<AppRoute> {
        stops += sessionId
        return MutationResult.Done(AppRoute.Session(sessionId = sessionId.toString(), stopped = true))
    }
}

private fun sessionCompletion(sessionCompleted: Boolean) =
    JsonObject(
        ApiJson.parseToJsonElement(COMPLETION).jsonObject +
            ("studyBlock" to fixture("study-block-completion", "sessionCompleted" to sessionCompleted)),
    ).toString()

private const val SESSION_ID = "00000000-0000-4000-8000-000000000051"
