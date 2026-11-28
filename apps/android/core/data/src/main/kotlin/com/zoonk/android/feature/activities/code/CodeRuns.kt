package com.zoonk.android.feature.activities.code

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.streamFailure
import com.zoonk.android.data.withBearer
import com.zoonk.api.ApiJson
import com.zoonk.api.ApiRequestJson
import com.zoonk.api.models.RunCodeRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.UUID
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** How far a run on our servers got. */
@Serializable
enum class CodeRunPhase {
    @SerialName("starting")
    Starting,

    @SerialName("compiling")
    Compiling,

    @SerialName("running")
    Running,
}

sealed interface CodeRunUpdate {
    data class Phase(
        val phase: CodeRunPhase,
    ) : CodeRunUpdate

    /** The run's end: what it printed, with its [ProgramRun.runId], or why it didn't run (a refusal, no connection). */
    data class Ended(
        val result: MutationResult<ProgramRun>,
    ) : CodeRunUpdate
}

/**
 * Runs a program in a language that [CodeLanguage.runsOnServer] on our servers, as the session current when it starts.
 * [requestId] names one tap: asking again with it, after a lost connection, never runs or charges twice.
 */
fun interface CodeRuns {
    fun run(
        requestId: UUID,
        language: CodeLanguage,
        code: String,
    ): Flow<CodeRunUpdate>
}

/**
 * `POST /v1/code-runs`, refreshing the learner's allowance once it ran. While another run of the learner's is going (a
 * double tap, another device, or this tap's own run before the connection dropped), it asks again every [retryEvery] under
 * the same request until the server takes it or answers it, so the learner sees Run busy rather than an error; the server
 * ends a lost run, so the asking ends too. Call it on the main thread.
 */
class LiveCodeRuns(
    private val api: ApiClients,
    private val cache: AppCache,
    private val retryEvery: Duration = 1.seconds,
) : CodeRuns {
    override fun run(
        requestId: UUID,
        language: CodeLanguage,
        code: String,
    ): Flow<CodeRunUpdate> =
        channelFlow {
            val result =
                cache.mutate(invalidating = setOf(DataDomain.Allowance)) { session ->
                    var finished: ProgramRun? = null
                    admitted(session, requestId, language, code).collect { event ->
                        when (event) {
                            is CodeRunEvent.Phase -> send(CodeRunUpdate.Phase(event.phase))
                            is CodeRunEvent.Finished -> finished = event.run
                        }
                    }
                    finished ?: throw ApiException(ApiError.Unavailable)
                }
            send(CodeRunUpdate.Ended(result))
        }

    private fun admitted(
        session: AuthenticatedSession,
        requestId: UUID,
        language: CodeLanguage,
        code: String,
    ): Flow<CodeRunEvent> =
        flow {
            while (true) {
                try {
                    emitAll(api.codeRunEvents(session, requestId, language, code))
                    return@flow
                } catch (e: ApiException) {
                    if (e.status != ALREADY_RUNNING) throw e
                    delay(retryEvery)
                }
            }
        }
}

/** The API's status while another run of the learner's is going. */
private const val ALREADY_RUNNING = 409

internal sealed interface CodeRunEvent {
    data class Phase(
        val phase: CodeRunPhase,
    ) : CodeRunEvent

    data class Finished(
        val run: ProgramRun,
    ) : CodeRunEvent
}

@Serializable
private class PhaseEvent(
    val phase: CodeRunPhase,
)

/**
 * One request's stream: its `phase` events, then its one `result`. A stream that ends without a result broke off on the
 * way, so it fails as [ApiError.Network], like a dropped connection; a result this build can't read as [ApiError.Unavailable].
 */
internal fun ApiClients.codeRunEvents(
    session: AuthenticatedSession,
    requestId: UUID,
    language: CodeLanguage,
    code: String,
): Flow<CodeRunEvent> =
    callbackFlow {
        val runLanguage = RunCodeRequest.Language.entries.first { it.value == language.id }
        val body = ApiRequestJson.encodeToString(RunCodeRequest.serializer(), RunCodeRequest(code, runLanguage, requestId))
        val request =
            Request
                .Builder()
                .url(baseUrl.newBuilder().addPathSegment("code-runs").build())
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
        val listener =
            object : EventSourceListener() {
                private var finished = false

                override fun onEvent(
                    eventSource: EventSource,
                    id: String?,
                    type: String?,
                    data: String,
                ) {
                    when (type) {
                        // A stage this build doesn't know keeps the one it shows.
                        "phase" -> {
                            runCatching { ApiJson.decodeFromString<PhaseEvent>(data) }.getOrNull()?.let {
                                trySendBlocking(CodeRunEvent.Phase(it.phase))
                            }
                        }

                        "result" -> {
                            val run =
                                try {
                                    ApiJson.decodeFromString<ProgramRun>(data).takeIf { it.runId?.let(::isUuid) == true }
                                } catch (e: SerializationException) {
                                    null
                                }
                            finished = run != null
                            if (run != null) trySendBlocking(CodeRunEvent.Finished(run))
                            close(if (run == null) ApiException(ApiError.Unavailable) else null)
                        }
                    }
                }

                override fun onClosed(eventSource: EventSource) {
                    close(if (finished) null else ApiException(ApiError.Network))
                }

                override fun onFailure(
                    eventSource: EventSource,
                    t: Throwable?,
                    response: Response?,
                ) {
                    if (!finished) close(streamFailure(t, response))
                }
            }
        val source =
            EventSources
                .createFactory(streamingHttp.withBearer(session.bearerToken))
                .newEventSource(request, listener)
        awaitClose { source.cancel() }
    }

private fun isUuid(text: String) = runCatching { UUID.fromString(text) }.isSuccess
