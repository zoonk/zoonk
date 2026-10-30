package com.zoonk.android.feature.testout

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.practice.AnswersDraft
import com.zoonk.android.feature.practice.input
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.api.models.ChapterTestOutInput
import com.zoonk.api.models.ChapterTestOutRecord
import com.zoonk.api.models.CreateChapterTestOutGeneration200Response
import com.zoonk.api.models.GetChapterTestOut200Response
import com.zoonk.api.models.SubmitChapterTestOut200Response
import java.util.UUID

data class TestOutKey(
    val goalId: UUID,
    val chapterId: UUID,
)

data class RecordKey(
    val test: TestOutKey,
    val requestId: UUID,
)

sealed interface TestOutRead {
    /** No [questions] yet: the learner's Start writes them. */
    data class Ready(
        val passMark: Double,
        val questions: List<Question>,
        val words: TrueFalseWords,
    ) : TestOutRead

    data object PlusRequired : TestOutRead

    /** The plan already skips the whole chapter. */
    data object NothingToSkip : TestOutRead
}

interface TestOutApi {
    suspend fun testOut(
        session: AuthenticatedSession,
        key: TestOutKey,
    ): TestOutRead

    suspend fun writeQuestions(
        session: AuthenticatedSession,
        key: TestOutKey,
    ): CreateChapterTestOutGeneration200Response

    suspend fun submit(
        session: AuthenticatedSession,
        key: TestOutKey,
        input: ChapterTestOutInput,
    ): SubmitChapterTestOut200Response

    suspend fun recorded(
        session: AuthenticatedSession,
        key: RecordKey,
    ): ChapterTestOutRecord
}

class LiveTestOutApi(
    private val api: ApiClients,
) : TestOutApi {
    override suspend fun testOut(
        session: AuthenticatedSession,
        key: TestOutKey,
    ): TestOutRead =
        try {
            when (val read = perform { api.clients(session).learner.getChapterTestOut(key.goalId, key.chapterId) }) {
                is GetChapterTestOut200Response.ChapterTestOutValue -> {
                    TestOutRead.Ready(
                        passMark = read.value.passMark,
                        questions = read.value.questions.map { it.recode() },
                        words = read.value.trueFalseLabels.recode(),
                    )
                }

                is GetChapterTestOut200Response.NothingToSkipValue -> {
                    TestOutRead.NothingToSkip
                }
            }
        } catch (e: ApiException) {
            if (e.code == PLUS_REQUIRED) TestOutRead.PlusRequired else throw e
        }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        key: TestOutKey,
    ) = perform { api.clients(session).learner.createChapterTestOutGeneration(key.goalId, key.chapterId) }

    override suspend fun submit(
        session: AuthenticatedSession,
        key: TestOutKey,
        input: ChapterTestOutInput,
    ) = perform { api.clients(session).learner.submitChapterTestOut(key.goalId, key.chapterId, input) }

    override suspend fun recorded(
        session: AuthenticatedSession,
        key: RecordKey,
    ) = perform { api.clients(session).learner.getChapterTestOutResult(key.test.goalId, key.test.chapterId, key.requestId) }
}

/** A chapter's test-out: its questions, the answers kept on the device until graded, and their result. */
class TestOutStore(
    private val api: TestOutApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    val testOuts =
        cache.keyed<TestOutKey, TestOutRead>(Audience.SignedIn, READ_DOMAINS) { session, key ->
            session?.let { api.testOut(it, key) }
        }

    val records =
        cache.keyed<RecordKey, ChapterTestOutRecord>(Audience.SignedIn, READ_DOMAINS) { session, key ->
            session?.let { api.recorded(it, key) }
        }

    fun answers(
        session: AuthenticatedSession,
        key: TestOutKey,
    ): DraftHandle<AnswersDraft> = drafts.open(session, "test-out:${key.goalId}:${key.chapterId}", AnswersDraft.serializer())

    /** From the learner's Start only: it writes the questions. */
    suspend fun writeQuestions(key: TestOutKey): MutationResult<CreateChapterTestOutGeneration200Response> =
        cache.mutate { session -> api.writeQuestions(session, key) }

    /** The same [draft] sent again gets what it recorded the first time. */
    suspend fun submit(
        key: TestOutKey,
        draft: AnswersDraft,
    ): MutationResult<SubmitChapterTestOut200Response> =
        cache.mutate(invalidating = SUBMITTED) { session ->
            api.submit(session, key, ChapterTestOutInput(draft.answers.map { it.input() }, UUID.fromString(draft.requestId), timeZone()))
        }

    private companion object {
        val READ_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSubscription)
        val SUBMITTED = setOf(DataDomain.LearnerModel, DataDomain.UserProgress)
    }
}

private const val PLUS_REQUIRED = "PLUS_REQUIRED"
