package com.zoonk.android.data

import com.zoonk.api.ApiJson
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration.Companion.seconds

/** [at] is epoch milliseconds. */
@Serializable
data class GenerationEvent(
    val at: Long? = null,
    val entityId: String? = null,
    val reason: String? = null,
    val status: String,
    val step: String,
)

/**
 * Resumes after a dropped connection from the last event received, giving up after three drops in
 * a row without one. When it ends, read the generation's status: a stopped run ends its stream at once.
 */
fun ApiClients.generationEvents(
    id: String,
    session: AuthenticatedSession?,
): Flow<GenerationEvent> =
    flow {
        var received = 0
        var dropsWithoutEvents = 0
        while (true) {
            try {
                openGenerationEvents(id, session, startIndex = received).collect { event ->
                    received++
                    dropsWithoutEvents = 0
                    emit(event)
                }
                return@flow
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (e.error != ApiError.Network || dropsWithoutEvents == MAX_DROPS) throw e
                dropsWithoutEvents++
                delay(dropsWithoutEvents.seconds)
            }
        }
    }

private const val MAX_DROPS = 3

private fun ApiClients.openGenerationEvents(
    id: String,
    session: AuthenticatedSession?,
    startIndex: Int,
): Flow<GenerationEvent> =
    callbackFlow {
        val url =
            baseUrl
                .newBuilder()
                .addPathSegments("generations/$id/events")
                .addQueryParameter("startIndex", startIndex.toString())
                .build()
        val client = session?.let { streamingHttp.withBearer(it.bearerToken) } ?: streamingHttp
        val listener =
            object : EventSourceListener() {
                override fun onEvent(
                    eventSource: EventSource,
                    id: String?,
                    type: String?,
                    data: String,
                ) {
                    try {
                        trySendBlocking(ApiJson.decodeFromString<GenerationEvent>(data))
                    } catch (e: SerializationException) {
                        close(ApiException(ApiError.Unavailable))
                    }
                }

                override fun onClosed(eventSource: EventSource) {
                    close()
                }

                override fun onFailure(
                    eventSource: EventSource,
                    t: Throwable?,
                    response: Response?,
                ) {
                    close(streamFailure(t, response))
                }
            }
        val source = EventSources.createFactory(client).newEventSource(Request.Builder().url(url).build(), listener)
        awaitClose { source.cancel() }
    }

private fun streamFailure(
    t: Throwable?,
    response: Response?,
): ApiException =
    when {
        response != null && !response.isSuccessful -> {
            ApiException(
                when (response.code) {
                    401 -> ApiError.Unauthorized
                    404 -> ApiError.NotFound
                    else -> ApiError.Unavailable
                },
            )
        }

        t is IOException -> {
            ApiException(ApiError.Network)
        }

        else -> {
            ApiException(ApiError.Unavailable)
        }
    }
