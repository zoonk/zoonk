package com.zoonk.android.feature.buddy

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.EarlierQuestion
import com.zoonk.api.models.EarlierQuestions
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID
import kotlin.time.Instant

internal fun earlierQuestion(
    n: Int,
    answer: String? = "Answer $n",
    courseTitle: String? = "Atoms",
    lessonTitle: String? = "Bonds",
) = EarlierQuestion(
    answer = answer,
    askedAt = Instant.parse("2026-01-01T00:00:00Z"),
    courseTitle = courseTitle,
    id = UUID(0, n.toLong()),
    lessonTitle = lessonTitle,
    question = "Question $n",
)

/** Two pages, newest first: questions 1 and 2, then 3 and 4. */
internal class FakeEarlierQuestionsApi : EarlierQuestionsApi {
    var first = EarlierQuestions(nextCursor = UUID(0, 2), questions = listOf(earlierQuestion(1), earlierQuestion(2)))
    var older = EarlierQuestions(nextCursor = null, questions = listOf(earlierQuestion(3), earlierQuestion(4)))
    val reads = mutableListOf<Pair<String, UUID?>>()
    var firstFailure: ApiException? = null
    var olderGate: CompletableDeferred<Unit>? = null
    var olderFailure: ApiException? = null

    override suspend fun page(
        session: AuthenticatedSession,
        cursor: UUID?,
    ): EarlierQuestions {
        reads += session.accountId to cursor
        if (cursor == null) return firstFailure?.let { throw it } ?: first
        olderGate?.await()
        olderFailure?.let { throw it }
        return older
    }
}
