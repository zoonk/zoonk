package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.android.data.performOrNull
import com.zoonk.android.data.withBearer
import com.zoonk.api.ApiJson
import com.zoonk.api.apis.ChaptersApi
import com.zoonk.api.apis.ExamsApi
import com.zoonk.api.apis.LessonsApi
import com.zoonk.api.apis.PlansApi
import com.zoonk.api.apis.StudySessionsApi
import com.zoonk.api.models.CreateLessonQuestionRequest
import com.zoonk.api.models.CreatedLessonQuestion
import com.zoonk.api.models.Error
import com.zoonk.api.models.LessonQuestion
import com.zoonk.api.models.LessonQuestionContext
import com.zoonk.api.models.LessonQuestionContextInput
import com.zoonk.api.models.LessonQuestionContextInputOneOf
import com.zoonk.api.models.LessonQuestionContextInputOneOf1
import com.zoonk.api.models.LessonQuestionContextInputOneOf2
import com.zoonk.api.models.LessonQuestionContextInputOneOf3
import com.zoonk.api.models.LessonQuestionContextInputOneOf4
import com.zoonk.api.models.LessonQuestionThread
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.io.IOException
import java.util.UUID
import kotlin.time.Instant

internal interface TutorApi {
    /** Null before the conversation's first question. */
    suspend fun thread(
        key: TutorThreadKey,
        cursor: String?,
        session: AuthenticatedSession?,
    ): TutorThread?

    suspend fun ask(
        scope: TutorScope,
        question: String,
        suggestion: String?,
        requestId: String,
        session: AuthenticatedSession,
    ): AskedQuestion

    /** Throws [ApiException] when it's refused or the connection drops before an answer is saved. */
    fun answer(
        questionId: String,
        session: AuthenticatedSession,
    ): Flow<TutorAnswerEvent>

    suspend fun question(
        id: String,
        session: AuthenticatedSession,
    ): TutorTurn
}

internal class LiveTutorApi(
    private val api: ApiClients,
) : TutorApi {
    override suspend fun thread(
        key: TutorThreadKey,
        cursor: String?,
        session: AuthenticatedSession?,
    ): TutorThread? {
        val clients = api.clients(session)
        val page = cursor?.let(UUID::fromString)
        val thread =
            performOrNull {
                when (key) {
                    is TutorThreadKey.Plan -> {
                        clients.plans.getPlanQuestionThread(key.goalId.id, PlansApi.ContextKindGetPlanQuestionThread.PLAN, page)
                    }

                    is TutorThreadKey.Subject -> {
                        clients.plans.getSubjectQuestionThread(
                            key.goalId.id,
                            key.subjectKey,
                            PlansApi.ContextKindGetSubjectQuestionThread.SUBJECT,
                            page,
                        )
                    }

                    is TutorThreadKey.Chapter -> {
                        clients.chapters.getChapterQuestionThread(
                            key.chapterId.id,
                            ChaptersApi.ContextKindGetChapterQuestionThread.CHAPTER,
                            page,
                        )
                    }

                    is TutorThreadKey.Mock -> {
                        clients.exams.getMockQuestionThread(key.blockId.id, ExamsApi.ContextKindGetMockQuestionThread.MOCK, page)
                    }

                    is TutorThreadKey.Lesson -> {
                        clients.lessons.getLessonQuestionThread(
                            key.lessonId.id,
                            LessonsApi.ContextKindGetLessonQuestionThread.LESSON,
                            page,
                        )
                    }

                    is TutorThreadKey.Step -> {
                        clients.lessons.getLessonQuestionThread(key.lessonId.id, cursor = page, stepId = key.stepId.id)
                    }

                    is TutorThreadKey.Item -> {
                        clients.studySessions.getItemQuestionThread(
                            key.itemId.id,
                            StudySessionsApi.ContextKindGetItemQuestionThread.ITEM,
                            page,
                        )
                    }
                }
            }
        return thread?.let(::thread)
    }

    override suspend fun ask(
        scope: TutorScope,
        question: String,
        suggestion: String?,
        requestId: String,
        session: AuthenticatedSession,
    ): AskedQuestion {
        val clients = api.clients(session)
        val request =
            CreateLessonQuestionRequest(
                context = scope.context,
                question = question,
                requestId = UUID.fromString(requestId),
                suggestion = suggestion?.let { id -> CreateLessonQuestionRequest.Suggestion.entries.first { it.value == id } },
            )
        val created =
            perform {
                when (scope) {
                    is TutorScope.Plan -> clients.plans.createPlanQuestion(scope.goalId.id, request)
                    is TutorScope.Subject -> clients.plans.createSubjectQuestion(scope.goalId.id, scope.subjectKey, request)
                    is TutorScope.Chapter -> clients.chapters.createChapterQuestion(scope.chapterId.id, request)
                    is TutorScope.Mock -> clients.exams.createMockQuestion(scope.blockId.id, request)
                    is TutorScope.Lesson -> clients.lessons.createLessonQuestion(scope.lessonId.id, request)
                    is TutorScope.Step -> clients.lessons.createLessonQuestion(scope.lessonId.id, request)
                    is TutorScope.Answer -> clients.lessons.createLessonQuestion(scope.lessonId.id, request)
                    is TutorScope.Item -> clients.studySessions.createItemQuestion(scope.itemId.id, request)
                }
            }
        return AskedQuestion(turn(created), created.missionMoment)
    }

    override fun answer(
        questionId: String,
        session: AuthenticatedSession,
    ): Flow<TutorAnswerEvent> =
        callbackFlow {
            val url =
                api.baseUrl
                    .newBuilder()
                    .addPathSegments("questions/$questionId/answers")
                    .build()
            val request =
                Request
                    .Builder()
                    .url(url)
                    .post("".toRequestBody())
                    .build()
            var saved = false
            var answered = false
            val listener =
                object : EventSourceListener() {
                    override fun onEvent(
                        eventSource: EventSource,
                        id: String?,
                        type: String?,
                        data: String,
                    ) {
                        if (data == DONE) return
                        val chunk =
                            try {
                                ApiJson.decodeFromString<AnswerChunk>(data)
                            } catch (e: SerializationException) {
                                return
                            }
                        if (chunk.type == "error") {
                            close(ApiException(ApiError.Unavailable))
                            return
                        }
                        val event = answerEvent(chunk) ?: return
                        if (event is TutorAnswerEvent.Finish) saved = true
                        if (event is TutorAnswerEvent.Text && event.delta.isNotEmpty()) answered = true
                        trySendBlocking(event)
                    }

                    override fun onClosed(eventSource: EventSource) {
                        close(if (saved || answered) null else ApiException(ApiError.Unavailable))
                    }

                    override fun onFailure(
                        eventSource: EventSource,
                        t: Throwable?,
                        response: Response?,
                    ) {
                        // An answer saved before the connection dropped still counts.
                        close(if (saved) null else refusal(t, response))
                    }
                }
            val source = EventSources.createFactory(api.streamingHttp.withBearer(session.bearerToken)).newEventSource(request, listener)
            awaitClose { source.cancel() }
        }

    override suspend fun question(
        id: String,
        session: AuthenticatedSession,
    ): TutorTurn = turn(perform { api.clients(session).lessons.getLessonQuestion(id.id) })
}

private val String.id: UUID get() = UUID.fromString(this)

private const val DONE = "[DONE]"

/** An AI SDK UI message chunk; the parts the conversation doesn't read decode to nothing. */
@Serializable
private class AnswerChunk(
    val type: String,
    val delta: String? = null,
    val data: JsonElement? = null,
)

/** A part that doesn't decode is skipped, as main skips it. */
private fun answerEvent(chunk: AnswerChunk): TutorAnswerEvent? {
    val data = chunk.data
    return try {
        when (chunk.type) {
            "text-delta" -> {
                chunk.delta?.let(TutorAnswerEvent::Text)
            }

            "finish" -> {
                TutorAnswerEvent.Finish
            }

            "data-saved-answer" -> {
                (data as? JsonObject)
                    ?.get("answer")
                    ?.jsonPrimitive
                    ?.content
                    ?.let(TutorAnswerEvent::SavedAnswer)
            }

            "data-plan-change" -> {
                data?.let { TutorAnswerEvent.Proposed(ApiJson.decodeFromJsonElement<PlanChange>(it)) }
            }

            "data-plan-changes-replaced" -> {
                data?.let { TutorAnswerEvent.Replaced(ApiJson.decodeFromJsonElement<ReplacedChanges>(it).ids) }
            }

            "data-tool-offer" -> {
                data?.let { TutorAnswerEvent.Offered(ApiJson.decodeFromJsonElement<TutorToolOffer>(it)) }
            }

            "data-memory" -> {
                data?.let { TutorAnswerEvent.Remembered(ApiJson.decodeFromJsonElement<List<TutorMemoryChange>>(it)) }
            }

            else -> {
                null
            }
        }
    } catch (e: SerializationException) {
        null
    } catch (e: IllegalArgumentException) {
        null
    }
}

@Serializable
private class ReplacedChanges(
    val ids: List<String>,
)

/** A refusal (a help limit, Plus required) comes as the response's error body. */
private fun refusal(
    t: Throwable?,
    response: Response?,
): ApiException {
    if (response == null || response.isSuccessful) {
        return ApiException(if (t is IOException) ApiError.Network else ApiError.Unavailable)
    }
    val error =
        try {
            response.body.string().let { ApiJson.decodeFromString<Error>(it).error }
        } catch (e: SerializationException) {
            null
        } catch (e: IOException) {
            null
        }
    val kind =
        when (response.code) {
            401 -> ApiError.Unauthorized
            404 -> ApiError.NotFound
            else -> ApiError.Unavailable
        }
    return ApiException(kind, error?.code, response.code, error?.details)
}

private val TutorScope.context: LessonQuestionContextInput
    get() =
        when (this) {
            is TutorScope.Plan -> {
                screen(LessonQuestionContextInputOneOf3.Kind.PLAN)
            }

            is TutorScope.Subject -> {
                screen(LessonQuestionContextInputOneOf3.Kind.SUBJECT)
            }

            is TutorScope.Chapter -> {
                screen(LessonQuestionContextInputOneOf3.Kind.CHAPTER)
            }

            is TutorScope.Mock -> {
                screen(LessonQuestionContextInputOneOf3.Kind.MOCK)
            }

            is TutorScope.Lesson -> {
                LessonQuestionContextInput.LessonQuestionContextInputOneOfValue(
                    LessonQuestionContextInputOneOf(
                        LessonQuestionContextInputOneOf.Kind.LESSON,
                        stepIds.map(UUID::fromString).takeIf { it.isNotEmpty() },
                    ),
                )
            }

            is TutorScope.Step -> {
                LessonQuestionContextInput.LessonQuestionContextInputOneOf1Value(
                    LessonQuestionContextInputOneOf1(LessonQuestionContextInputOneOf1.Kind.STEP, stepId.id, stepNumber.toLong()),
                )
            }

            is TutorScope.Answer -> {
                LessonQuestionContextInput.LessonQuestionContextInputOneOf2Value(
                    LessonQuestionContextInputOneOf2(answer, LessonQuestionContextInputOneOf2.Kind.ANSWER, stepId.id, stepNumber.toLong()),
                )
            }

            is TutorScope.Item -> {
                LessonQuestionContextInput.LessonQuestionContextInputOneOf4Value(
                    LessonQuestionContextInputOneOf4(answered, LessonQuestionContextInputOneOf4.Kind.ITEM, blockId?.id),
                )
            }
        }

private fun screen(kind: LessonQuestionContextInputOneOf3.Kind) =
    LessonQuestionContextInput.LessonQuestionContextInputOneOf3Value(LessonQuestionContextInputOneOf3(kind))

private fun thread(thread: LessonQuestionThread) = TutorThread(thread.questions.map(::turn), thread.hasMore, thread.nextCursor?.toString())

private fun turn(question: LessonQuestion) =
    with(question) { turn(id, this.question, answer, status.value, createdAt, context, planChange, toolOffer) }

private fun turn(question: CreatedLessonQuestion) =
    with(question) { turn(id, this.question, answer, status.value, createdAt, context, planChange, toolOffer) }

private fun turn(
    id: UUID,
    question: String,
    answer: String?,
    status: String,
    createdAt: Instant,
    context: LessonQuestionContext,
    planChange: PlanChange?,
    toolOffer: TutorToolOffer?,
) = TutorTurn(
    id = id.toString(),
    question = question,
    answer = answer,
    status = TutorTurn.Status.entries.first { it.name.equals(status, ignoreCase = true) },
    createdAt = createdAt,
    about = about(context),
    planChange = planChange,
    toolOffer = toolOffer,
)

private fun about(context: LessonQuestionContext): TutorTurn.About =
    when (context) {
        is LessonQuestionContext.LessonQuestionContextOneOfValue -> {
            TutorTurn.About.Lesson
        }

        is LessonQuestionContext.LessonQuestionContextOneOf1Value -> {
            if (context.value.answered) TutorTurn.About.Answer else TutorTurn.About.Item
        }

        is LessonQuestionContext.LessonQuestionContextOneOf2Value -> {
            TutorTurn.About.Step
        }

        is LessonQuestionContext.LessonQuestionContextOneOf3Value -> {
            TutorTurn.About.Answer
        }

        is LessonQuestionContext.LessonQuestionContextInputOneOf3Value -> {
            when (context.value.kind) {
                LessonQuestionContextInputOneOf3.Kind.CHAPTER -> TutorTurn.About.Chapter
                LessonQuestionContextInputOneOf3.Kind.PLAN -> TutorTurn.About.Plan
                LessonQuestionContextInputOneOf3.Kind.MOCK -> TutorTurn.About.Mock
                LessonQuestionContextInputOneOf3.Kind.SUBJECT -> TutorTurn.About.Subject
            }
        }
    }
