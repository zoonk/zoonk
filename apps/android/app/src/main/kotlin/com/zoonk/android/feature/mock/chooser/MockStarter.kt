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
import com.zoonk.api.models.MockQuestionsGeneration
import com.zoonk.api.models.MockQuestionsInput
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.PlacementMockOption
import kotlinx.coroutines.delay
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

/** What the learner picked: one of the goal's mocks, or how long a placement mock runs. */
sealed interface MockChoice {
    data class Practice(
        val shape: MockShape,
    ) : MockChoice

    data class Placement(
        val length: PlacementMockOption.Length,
    ) : MockChoice
}

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
    ) : MockStartOutcome

    data object NeedsQuestions : MockStartOutcome

    data object NotEnoughQuestions : MockStartOutcome

    data object PlusRequired : MockStartOutcome
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
}

interface MockStartApi {
    suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
        acceptFewer: Boolean,
    ): AnytimeMock

    suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
    ): MockQuestionsGeneration
}

class LiveMockStartApi(
    private val api: ApiClients,
) : MockStartApi {
    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
        acceptFewer: Boolean,
    ) = perform {
        api.clients(session).exams.startAnytimeMock(
            goalId,
            when (choice) {
                is MockChoice.Practice -> {
                    AnytimeMockInput(
                        purpose = AnytimeMockInput.Purpose.PRACTICE,
                        shape = choice.shape,
                        acceptFewer = acceptFewer,
                    )
                }

                is MockChoice.Placement -> {
                    AnytimeMockInput(
                        length = AnytimeMockInput.Length.valueOf(choice.length.name),
                        purpose = AnytimeMockInput.Purpose.PLACEMENT,
                        acceptFewer = acceptFewer,
                    )
                }
            },
        )
    }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
    ) = perform {
        api.clients(session).exams.createMockQuestionsGeneration(
            goalId,
            when (choice) {
                is MockChoice.Practice -> {
                    MockQuestionsInput(purpose = MockQuestionsInput.Purpose.PRACTICE, shape = choice.shape)
                }

                is MockChoice.Placement -> {
                    MockQuestionsInput(
                        length = MockQuestionsInput.Length.valueOf(choice.length.name),
                        purpose = MockQuestionsInput.Purpose.PLACEMENT,
                    )
                }
            },
        )
    }
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
        choice: MockChoice,
        acceptFewer: Boolean,
    ): MutationResult<MockStartOutcome> {
        val result =
            cache.mutate { session ->
                try {
                    outcome(api.start(session, goalId, choice, acceptFewer))
                } catch (e: ApiException) {
                    when (e.code) {
                        PLUS_REQUIRED -> MockStartOutcome.PlusRequired
                        NOT_ENOUGH_QUESTIONS -> MockStartOutcome.NotEnoughQuestions
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
        choice: MockChoice,
    ): MutationResult<QuestionWriting> {
        val result =
            cache.mutate { session ->
                try {
                    var writing = api.writeQuestions(session, goalId, choice)
                    var asked = 1
                    while (writing.status == MockQuestionsGeneration.Status.PREPARING && asked < PREPARING_TRIES) {
                        delay(PREPARING_RETRY)
                        writing = api.writeQuestions(session, goalId, choice)
                        asked++
                    }
                    writing.generationId?.takeIf { writing.status == MockQuestionsGeneration.Status.GENERATING }?.let(
                        QuestionWriting::Writing,
                    )
                        ?: QuestionWriting.Ready
                } catch (e: ApiException) {
                    Limit.of(e)?.let(QuestionWriting::Refused) ?: if (e.code == PLUS_REQUIRED) QuestionWriting.PlusRequired else throw e
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
                )
            }
        }

    private companion object {
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
        const val NOT_ENOUGH_QUESTIONS = "NOT_ENOUGH_QUESTIONS"
        const val PREPARING_TRIES = 60
        val PREPARING_RETRY = 3.seconds
    }
}
