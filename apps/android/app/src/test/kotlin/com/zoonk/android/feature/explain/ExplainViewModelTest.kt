package com.zoonk.android.feature.explain

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Explanation
import com.zoonk.api.models.Generation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

private const val GOAL_ID = "00000000-0000-4000-8000-000000000031"

private fun explanation(
    status: String,
    generationId: String?,
): Explanation =
    ApiJson.decodeFromString(
        Explanation.serializer(),
        """
        {"generationId":${generationId?.let { "\"$it\"" } ?: "null"},"goFurther":{"course":null,"questions":[]},"goalId":"$GOAL_ID",
         "hasStudyGoal":false,"lesson":null,"outline":[],"question":"Why is the sky blue?","recap":[],"status":"$status","title":"Why is the sky blue?"}
        """.trimIndent(),
    )

@OptIn(ExperimentalCoroutinesApi::class)
class ExplainViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val followed = mutableListOf<String>()
    private val writes = mutableListOf<String>()
    private var events = listOf<GenerationEvent>()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.viewModel(): ExplainViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val api =
            object : ExplainApi {
                override suspend fun explanation(
                    session: AuthenticatedSession,
                    goalId: String,
                ) = explanation("preparing", "gen-1")

                override suspend fun writeAgain(
                    session: AuthenticatedSession,
                    goalId: String,
                ) = "gen-2".also { writes += goalId }

                override suspend fun recordWait(
                    session: AuthenticatedSession,
                    milliseconds: Long,
                ) = Unit
            }
        val source =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> = flowOf(*events.toTypedArray()).also { followed += id }

                override suspend fun status(id: String) = Generation.Status.COMPLETED
            }
        return ExplainViewModel(GOAL_ID, ExplainStore(api, cache), cache, session, { source }) { testScheduler.currentTime }
    }

    @Test
    fun anExplanationBeingWrittenIsFollowedUntilItsRunEnds() =
        runTest(dispatcher) {
            events = listOf(GenerationEvent(status = "completed", step = "writeExplanation"))
            val viewModel = viewModel()

            viewModel.show(explanation("preparing", "gen-1"))
            advanceUntilIdle()

            assertEquals(listOf("gen-1"), followed)
            assertEquals(GenerationRun.Status.Ready, viewModel.run.value.status)
        }

    @Test
    fun aSlowExplanationIsWrittenAgainOnlyWhileItIsStillBeingPrepared() =
        runTest(dispatcher) {
            val viewModel = viewModel()

            viewModel.show(explanation("preparing", "gen-1"))
            assertEquals(true, viewModel.retrySlow(explanation("ready", null)))
            assertEquals(emptyList<String>(), writes)

            assertEquals(true, viewModel.retrySlow(explanation("preparing", "gen-1")))
            advanceUntilIdle()
            assertEquals(listOf(GOAL_ID), writes)
            assertEquals("gen-2", followed.last())
        }

    @Test
    fun aTitleBecomesATopicMidSentenceKeepingAcronyms() {
        assertEquals("why is the sky blue", topicOf("Why is the sky blue?"))
        assertEquals("DNA replication", topicOf("DNA replication."))
    }
}
