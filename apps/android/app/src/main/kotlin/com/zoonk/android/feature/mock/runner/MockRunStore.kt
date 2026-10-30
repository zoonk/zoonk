package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.MockAnswer
import com.zoonk.api.models.MockAnswerInput
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockPlanOfferInput
import com.zoonk.api.models.MockPlanOfferResult
import com.zoonk.api.models.MockPlayInput
import com.zoonk.api.models.MockTimeZoneInput
import kotlinx.coroutines.flow.first
import kotlinx.serialization.builtins.ListSerializer
import retrofit2.Response
import java.util.UUID

/** What a mock answer's save came to: kept, or refused (time up, a locked answer); a failure to reach the server throws. */
enum class SaveOutcome { Stored, Refused }

/** A play the server counted, or none left (another device used the last one). */
sealed interface PlayOutcome {
    data class Counted(
        val played: Int,
    ) : PlayOutcome

    data object UsedUp : PlayOutcome
}

/** Grading a finished mock's essays either graded every written one, or ran into today's limit first. */
enum class EssayGradeOutcome { Graded, LimitReached }

data class GradedEssays(
    val mock: MockExam,
    val limitReached: Boolean,
)

interface MockRunApi {
    /** Null once it's gone. */
    suspend fun mock(
        session: AuthenticatedSession,
        blockId: String,
    ): MockExam?

    suspend fun save(
        session: AuthenticatedSession,
        blockId: String,
        draft: MockDraft,
    ): SaveOutcome

    suspend fun submitSection(
        session: AuthenticatedSession,
        blockId: String,
        section: Int,
        timeZone: String,
    )

    suspend fun endBreak(
        session: AuthenticatedSession,
        blockId: String,
    )

    suspend fun play(
        session: AuthenticatedSession,
        blockId: String,
        setId: String,
    ): PlayOutcome

    suspend fun startSpeaking(
        session: AuthenticatedSession,
        blockId: String,
    )

    suspend fun finish(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    )

    suspend fun gradeEssays(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    ): EssayGradeOutcome

    suspend fun adapt(
        session: AuthenticatedSession,
        blockId: String,
        offer: MockPlanOfferInput.Offer,
        timeZone: String,
    ): MockPlanOfferResult
}

class LiveMockRunApi(
    private val api: ApiClients,
) : MockRunApi {
    override suspend fun mock(
        session: AuthenticatedSession,
        blockId: String,
    ) = try {
        perform { api.clients(session).exams.getMock(UUID.fromString(blockId)) }
    } catch (e: ApiException) {
        if (e.error == ApiError.NotFound) null else throw e
    }

    override suspend fun save(
        session: AuthenticatedSession,
        blockId: String,
        draft: MockDraft,
    ): SaveOutcome =
        try {
            perform {
                api.clients(session).exams.saveMockAnswer(
                    UUID.fromString(blockId),
                    MockAnswerInput(draft.answer?.recode<Answer, MockAnswer>(), draft.durationMs, draft.flagged, UUID.fromString(draft.itemId)),
                )
            }
            SaveOutcome.Stored
        } catch (e: ApiException) {
            // The server won't keep it (time's up, the answer is locked, the mock is gone): sending it again changes nothing.
            if (e.error == ApiError.NotFound || (e.error == ApiError.Unavailable && e.status in REFUSALS)) SaveOutcome.Refused else throw e
        }

    override suspend fun submitSection(
        session: AuthenticatedSession,
        blockId: String,
        section: Int,
        timeZone: String,
    ) {
        stepping { api.clients(session).exams.submitMockSection(UUID.fromString(blockId), section.toLong(), MockTimeZoneInput(timeZone)) }
    }

    override suspend fun endBreak(
        session: AuthenticatedSession,
        blockId: String,
    ) {
        stepping { api.clients(session).exams.endMockBreak(UUID.fromString(blockId)) }
    }

    override suspend fun play(
        session: AuthenticatedSession,
        blockId: String,
        setId: String,
    ): PlayOutcome =
        try {
            PlayOutcome.Counted(
                perform {
                    api.clients(session).exams.recordMockPlay(UUID.fromString(blockId), MockPlayInput(UUID.fromString(setId)))
                }.played.toInt(),
            )
        } catch (e: ApiException) {
            if (e.code == PLAYS_USED) PlayOutcome.UsedUp else throw e
        }

    override suspend fun startSpeaking(
        session: AuthenticatedSession,
        blockId: String,
    ) {
        perform { api.clients(session).exams.startMockSpeaking(UUID.fromString(blockId)) }
    }

    override suspend fun finish(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    ) {
        stepping { api.clients(session).exams.finishMock(UUID.fromString(blockId), MockTimeZoneInput(timeZone)) }
    }

    override suspend fun gradeEssays(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    ): EssayGradeOutcome =
        try {
            perform { api.streamingClients(session).exams.gradeMockEssays(UUID.fromString(blockId), MockTimeZoneInput(timeZone)) }
            EssayGradeOutcome.Graded
        } catch (e: ApiException) {
            if (e.code == ESSAY_LIMIT_REACHED) EssayGradeOutcome.LimitReached else throw e
        }

    override suspend fun adapt(
        session: AuthenticatedSession,
        blockId: String,
        offer: MockPlanOfferInput.Offer,
        timeZone: String,
    ): MockPlanOfferResult =
        perform { api.clients(session).exams.adaptPlanFromMock(UUID.fromString(blockId), MockPlanOfferInput(offer, timeZone)) }

    /** A step another device already took (409) leaves the mock as it stands, which the read after it shows. */
    private suspend inline fun <reified T> stepping(noinline call: suspend () -> Response<T>) {
        try {
            perform(call)
        } catch (e: ApiException) {
            if (e.status != CONFLICT) throw e
        }
    }

    private companion object {
        const val CONFLICT = 409
        val REFUSALS = setOf(400, CONFLICT, 422)
        const val PLAYS_USED = "MOCK_PLAYS_USED"
        const val ESSAY_LIMIT_REACHED = "ESSAY_LIMIT_REACHED"
    }
}

/** The mock as the server has it and the answers this device hasn't sent yet: a runner starts from both. */
data class OpenedMock(
    val view: MockExam,
    val unsent: List<MockDraft>,
)

/** A running mock's reads and writes; its unsent answers wait on the device until the server has them. */
class MockRunStore(
    private val api: MockRunApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    /** Each opening reads the mock again, as main's page does, so a runner never starts from a read older than its saves. */
    fun open(blockId: String): Resource<OpenedMock> =
        cache.resource(Audience.SignedIn) { session ->
            session ?: return@resource null
            val view = api.mock(session, blockId) ?: return@resource null
            OpenedMock(view, unsent(session, blockId).value.first().orEmpty())
        }

    fun unsent(
        session: AuthenticatedSession,
        blockId: String,
    ): DraftHandle<List<MockDraft>> = drafts.open(session, "mock:$blockId", ListSerializer(MockDraft.serializer()))

    suspend fun save(
        blockId: String,
        draft: MockDraft,
    ): MutationResult<SaveOutcome> = cache.mutate { api.save(it, blockId, draft) }

    suspend fun play(
        blockId: String,
        setId: String,
    ): MutationResult<PlayOutcome> = cache.mutate { api.play(it, blockId, setId) }

    /** Each step reads the mock again, which then shows where it stands. Handing in the last section grades it. */
    suspend fun submitSection(
        blockId: String,
        section: Int,
    ): MutationResult<MockExam?> = step(blockId, FINISHING) { api.submitSection(it, blockId, section, timeZone()) }

    suspend fun endBreak(blockId: String): MutationResult<MockExam?> = step(blockId) { api.endBreak(it, blockId) }

    suspend fun startSpeaking(blockId: String): MutationResult<MockExam?> = step(blockId) { api.startSpeaking(it, blockId) }

    suspend fun finish(blockId: String): MutationResult<MockExam?> = step(blockId, FINISHING) { api.finish(it, blockId, timeZone()) }

    /** Grading writes the essays' grades and records them as the learner's answers; a limit reached still shows those graded first. */
    suspend fun gradeEssays(blockId: String): MutationResult<GradedEssays?> =
        cache.mutate(invalidating = setOf(DataDomain.LearnerModel)) { session ->
            val outcome = api.gradeEssays(session, blockId, timeZone())
            api.mock(session, blockId)?.let { GradedEssays(it, outcome == EssayGradeOutcome.LimitReached) }
        }

    /** One of the result's plan offers, only on the learner's yes: it changes the plan as any plan edit does. */
    suspend fun adapt(
        blockId: String,
        offer: MockPlanOfferInput.Offer,
    ): MutationResult<MockPlanOfferResult> =
        cache.mutate(invalidating = PlanStore.WRITE_DOMAINS) { api.adapt(it, blockId, offer, timeZone()) }

    private suspend fun step(
        blockId: String,
        invalidating: Set<DataDomain> = emptySet(),
        write: suspend (AuthenticatedSession) -> Unit,
    ): MutationResult<MockExam?> =
        cache.mutate(invalidating) { session ->
            write(session)
            api.mock(session, blockId)
        }

    private companion object {
        /** A graded mock completes its block in the day's session, moves progress and the learner model, and can bring lessons back into the plan. */
        val FINISHING = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
