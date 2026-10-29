package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.Error
import com.zoonk.api.models.ErrorError
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

enum class ApiError { Network, NotFound, Unauthorized, Unavailable }

/**
 * [code] is the API's error code (`RATE_LIMIT_EXCEEDED`) when it sent one, with its [details];
 * [status] is the HTTP status, for refusals the error alone doesn't tell apart (402, 403, 429).
 */
class ApiException(
    val error: ApiError,
    val code: String? = null,
    val status: Int? = null,
    val details: JsonElement? = null,
) : Exception(code ?: error.name)

fun Throwable.toApiError(): ApiError =
    when (this) {
        is ApiException -> error
        is IOException -> ApiError.Network
        else -> ApiError.Unavailable
    }

/**
 * Throws [ApiException]: no connection is [ApiError.Network], 401 [ApiError.Unauthorized], 404
 * [ApiError.NotFound], anything else or an unreadable body [ApiError.Unavailable]. Cancellation
 * propagates.
 */
suspend inline fun <reified T> perform(noinline call: suspend () -> Response<T>): T {
    val response = send(call)
    // Retrofit gives no body for a 204.
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
    val body = errorBody(response)
    throw ApiException(error, body?.code, response.code(), body?.details)
}

private fun errorBody(response: Response<*>): ErrorError? =
    try {
        response.errorBody()?.string()?.let { ApiJson.decodeFromString<Error>(it).error }
    } catch (e: SerializationException) {
        null
    } catch (e: IOException) {
        null
    }
