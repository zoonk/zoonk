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
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockPlayInput
import com.zoonk.api.models.MockTimeZoneInput
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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
                    buildJsonObject {
                        put("answer", draft.answer?.let { ApiJson.encodeToJsonElement(Answer.serializer(), it) } ?: JsonNull)
                        put("durationMs", draft.durationMs)
                        put("flagged", draft.flagged)
                        put("itemId", draft.itemId)
                    },
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
    }
}

/**
 * A running mock, by the id it opens with. It changes only by the learner's steps in it, each of
 * which reads it again, so no other write revalidates it; its unsent answers wait on the device.
 */
class MockRunStore(
    private val api: MockRunApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    val mock: KeyedResources<String, MockExam> =
        cache.keyed(Audience.SignedIn) { session, blockId -> session?.let { api.mock(it, blockId) } }

    /** Answers given but not stored yet, kept on the device until the server has them. */
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
    ): MutationResult<MockExam?> = step(blockId, setOf(DataDomain.LearnerModel)) { api.submitSection(it, blockId, section, timeZone()) }

    suspend fun endBreak(blockId: String): MutationResult<MockExam?> = step(blockId) { api.endBreak(it, blockId) }

    suspend fun startSpeaking(blockId: String): MutationResult<MockExam?> = step(blockId) { api.startSpeaking(it, blockId) }

    suspend fun finish(blockId: String): MutationResult<MockExam?> =
        step(blockId, setOf(DataDomain.LearnerModel)) {
            api.finish(it, blockId, timeZone())
        }

    /** A GET when its deadline may have passed long ago; it never scores the mock. */
    suspend fun reread(blockId: String) = mock[blockId].refresh()

    private suspend fun step(
        blockId: String,
        invalidating: Set<DataDomain> = emptySet(),
        write: suspend (AuthenticatedSession) -> Unit,
    ): MutationResult<MockExam?> =
        cache.mutate(invalidating = invalidating, replacing = { read ->
            listOfNotNull(read?.let { mock[blockId].replacing(it) })
        }) { session ->
            write(session)
            api.mock(session, blockId)
        }
}
