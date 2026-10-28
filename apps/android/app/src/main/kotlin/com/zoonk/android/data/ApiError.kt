package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.Error
import kotlinx.serialization.SerializationException
import retrofit2.Response
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

/** How a request failed, in the terms screens recover from. Cancellation is never one. */
enum class ApiError { Network, NotFound, Unauthorized, Unavailable }

/** A failed request. [code] is the API's error code (`RATE_LIMIT_EXCEEDED`) when it sent one. */
class ApiException(
    val error: ApiError,
    val code: String? = null,
) : Exception(code ?: error.name)

fun Throwable.toApiError(): ApiError =
    when (this) {
        is ApiException -> error
        is IOException -> ApiError.Network
        else -> ApiError.Unavailable
    }

/**
 * Runs one generated-service call and returns its body, so every feature maps failures the same
 * way: no connection is [ApiError.Network], 401 [ApiError.Unauthorized], 404
 * [ApiError.NotFound], any other failure or an unreadable body [ApiError.Unavailable].
 * Cancellation propagates. An operation answering 204 returns `Unit`.
 */
suspend inline fun <reified T> perform(noinline call: suspend () -> Response<T>): T {
    val response = send(call)
    // Retrofit gives no body for a 204; only a `Response<Unit>` operation answers with none.
    @Suppress("UNCHECKED_CAST")
    return response.body() ?: if (T::class == Unit::class) Unit as T else throw ApiException(ApiError.Unavailable)
}

@PublishedApi
internal suspend fun <T> send(call: suspend () -> Response<T>): Response<T> {
    val response =
        try {
            call()
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            throw ApiException(ApiError.Network)
        } catch (e: SerializationException) {
            throw ApiException(ApiError.Unavailable)
        }
    if (response.isSuccessful) return response
    val error =
        when (response.code()) {
            401 -> ApiError.Unauthorized
            404 -> ApiError.NotFound
            else -> ApiError.Unavailable
        }
    throw ApiException(error, errorCode(response))
}

private fun errorCode(response: Response<*>): String? =
    try {
        response.errorBody()?.string()?.let { ApiJson.decodeFromString<Error>(it).error.code }
    } catch (e: SerializationException) {
        null
    } catch (e: IOException) {
        null
    }
