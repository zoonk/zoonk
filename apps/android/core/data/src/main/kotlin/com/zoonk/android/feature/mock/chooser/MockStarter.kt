package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.AnytimeMockInputShape
import com.zoonk.api.models.AnytimeMockInputShapeAnyOf
import com.zoonk.api.models.MockQuestionsGeneration
import com.zoonk.api.models.MockQuestionsInput
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.WrittenTestShape
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.time.Instant
import java.util.UUID
import kotlin.time.Duration.Companion.seconds
import kotlin.time.toJavaInstant

sealed interface MockStartOutcome {
    /** Started now, or the one already running: either way the learner goes on in it. */
    data class Opened(
        val id: String,
    ) : MockStartOutcome

    /** The bank asks well under the questions picked and none can be written now. */
    data class Short(
        val questions: Long,
        val examQuestions: Long,
        val minutes: Long,
        val limit: AnytimeMock.Limit?,
        /** When the full mock fits again, for a cap counted over the last 30 days. */
        val availableAt: Instant?,
    ) : MockStartOutcome

    data object NeedsQuestions : MockStartOutcome

    data object NotEnoughQuestions : MockStartOutcome

    data object PlusRequired : MockStartOutcome

    /** A written test is admitted as it starts, and the day's extra grades are used: it starts tomorrow. */
    data object GradesUsed : MockStartOutcome
}

sealed interface QuestionWriting {
    /** Nothing to write, or nothing more for now: start with what the bank has. */
    data object Ready : QuestionWriting

    data class Writing(
        val generationId: String,
    ) : QuestionWriting

    data class Refused(
        val limit: Limit,
    ) : QuestionWriting

    data object PlusRequired : QuestionWriting

    /** A written test's questions would be graded as it starts, and today's extra grading is used: it returns tomorrow. */
    data object GradesUsed : QuestionWriting
}

/**
 * Which start this is: the learner's first tap, the start after a question-writing run (the server
 * then answers with the mock or its short numbers, never asks for questions again), or the start the
 * learner confirmed after seeing those numbers.
 */
enum class MockStartAsk { First, AfterWriting, AcceptFewer }

interface MockStartApi {
    suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
        ask: MockStartAsk,
    ): AnytimeMock

    suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ): MockQuestionsGeneration
}

class LiveMockStartApi(
    private val api: ApiClients,
) : MockStartApi {
    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
        ask: MockStartAsk,
    ) = perform {
        api.clients(session).exams.startAnytimeMock(
            goalId,
            AnytimeMockInput(
                shape = shape.input(),
                acceptFewer = ask == MockStartAsk.AcceptFewer,
                afterWriting = ask == MockStartAsk.AfterWriting,
            ),
        )
    }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ) = perform {
        api.clients(session).exams.createMockQuestionsGeneration(
            goalId,
            MockQuestionsInput(shape = shape.input()),
        )
    }
}

/** The day's extra writing allowance, rather than a plan's usage cap, says when it returns. */
private fun JsonElement?.hasReturnsOn(): Boolean = (this as? JsonObject)?.containsKey("returnsOn") == true

/** The written test is a shape of its own on the wire; every other option names its kind, day and subject. */
private fun MockShape.input(): AnytimeMockInputShape =
    if (kind == MockShape.Kind.WRITTEN) {
        AnytimeMockInputShape.WrittenTestShapeValue(WrittenTestShape(area = null, day = day, kind = WrittenTestShape.Kind.WRITTEN))
    } else {
        AnytimeMockInputShape.AnytimeMockInputShapeAnyOfValue(
            AnytimeMockInputShapeAnyOf(area, day, AnytimeMockInputShapeAnyOf.Kind.entries.first { it.value == kind.value }),
        )
    }

/**
 * Starts a mock taken any time, as main's chooser does: only from the learner's tap, since asking
 * for questions runs models.
 */
class MockStarter(
    private val api: MockStartApi,
    private val cache: AppCache,
) {
    suspend fun start(
        goalId: UUID,
        shape: MockShape,
        ask: MockStartAsk,
    ): MutationResult<MockStartOutcome> {
        val result =
            cache.mutate { session ->
                try {
                    outcome(api.start(session, goalId, shape, ask))
                } catch (e: ApiException) {
                    when {
                        e.code == PLUS_REQUIRED -> MockStartOutcome.PlusRequired
                        e.code == NOT_ENOUGH_QUESTIONS -> MockStartOutcome.NotEnoughQuestions
                        e.status == TOO_MANY_REQUESTS && e.code == null -> MockStartOutcome.GradesUsed
                        else -> throw e
                    }
                }
            }
        val outcome = (result as? MutationResult.Done)?.value
        if (outcome is MockStartOutcome.Opened) cache.invalidate(setOf(DataDomain.LearnerModel))
        if (outcome == MockStartOutcome.PlusRequired) cache.invalidate(setOf(DataDomain.UserSubscription))
        return result
    }

    /** While the goal's skill map is still drawn (a goal in onboarding), it asks again for a while. */
    suspend fun writeQuestions(
        goalId: UUID,
        shape: MockShape,
    ): MutationResult<QuestionWriting> {
        val result =
            cache.mutate { session ->
                try {
                    var writing = api.writeQuestions(session, goalId, shape)
                    var asked = 1
                    while (writing.status == MockQuestionsGeneration.Status.PREPARING && asked < PREPARING_TRIES) {
                        delay(PREPARING_RETRY)
                        writing = api.writeQuestions(session, goalId, shape)
                        asked++
                    }
                    writing.generationId?.takeIf { writing.status == MockQuestionsGeneration.Status.GENERATING }?.let(
                        QuestionWriting::Writing,
                    )
                        ?: QuestionWriting.Ready
                } catch (e: ApiException) {
                    when {
                        e.code == USAGE_LIMIT_REACHED && e.details.hasReturnsOn() -> {
                            QuestionWriting.GradesUsed
                        }

                        else -> {
                            Limit.of(e)?.let(QuestionWriting::Refused)
                                ?: if (e.code == PLUS_REQUIRED) QuestionWriting.PlusRequired else throw e
                        }
                    }
                }
            }
        if ((result as? MutationResult.Done)?.value == QuestionWriting.PlusRequired) cache.invalidate(setOf(DataDomain.UserSubscription))
        return result
    }

    private fun outcome(mock: AnytimeMock): MockStartOutcome =
        when (mock.status) {
            AnytimeMock.Status.STARTED, AnytimeMock.Status.RUNNING -> {
                MockStartOutcome.Opened(checkNotNull(mock.id).toString())
            }

            AnytimeMock.Status.NEEDS_QUESTIONS -> {
                MockStartOutcome.NeedsQuestions
            }

            AnytimeMock.Status.SHORT -> {
                MockStartOutcome.Short(
                    questions = mock.questions ?: 0,
                    examQuestions = mock.examQuestions ?: 0,
                    minutes = mock.minutes ?: 0,
                    limit = mock.limit,
                    availableAt = mock.availableAt?.toJavaInstant(),
                )
            }
        }

    private companion object {
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
        const val NOT_ENOUGH_QUESTIONS = "NOT_ENOUGH_QUESTIONS"
        const val USAGE_LIMIT_REACHED = "USAGE_LIMIT_REACHED"

        /** Its body is `{status: "limitReached", returnsOn}`, not an error's. */
        const val TOO_MANY_REQUESTS = 429
        const val PREPARING_TRIES = 60
        val PREPARING_RETRY = 3.seconds
    }
}
