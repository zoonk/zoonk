package com.zoonk.android.data

import com.zoonk.api.ApiServices
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * The generated services for a session. Every request carries the token of the session it was
 * made for, never a global one: stores call `api.clients(session).account.getCurrentUserSummary()`
 * with the session their read or write started with.
 *
 * @param baseUrl the API's versioned root, ending in `/v1/`.
 */
class ApiClients(
    val baseUrl: HttpUrl,
    val http: OkHttpClient,
) {
    /** For streams and writes the server takes long to answer (grading an essay is a model call). */
    val streamingHttp: OkHttpClient = http.newBuilder().readTimeout(120, TimeUnit.SECONDS).build()

    private val regular = Memo(http)
    private val streaming = Memo(streamingHttp)

    /** The services sending [session]'s bearer, or none when signed out. */
    fun clients(session: AuthenticatedSession?): ApiServices = regular[session]

    /** [clients] with a two-minute read timeout, for writes the server answers slowly. */
    fun streamingClients(session: AuthenticatedSession?): ApiServices = streaming[session]

    /** Keeps the latest session's services, so a screen's requests reuse them. */
    private inner class Memo(
        private val client: OkHttpClient,
    ) {
        private val anonymous by lazy { ApiServices(baseUrl, client) }
        private var latest: Pair<AuthenticatedSession, ApiServices>? = null

        @Synchronized
        operator fun get(session: AuthenticatedSession?): ApiServices {
            session ?: return anonymous
            latest?.takeIf { it.first == session }?.let { return it.second }
            return ApiServices(baseUrl, client.withBearer(session.bearerToken)).also { latest = session to it }
        }
    }
}

/** A copy of this client (sharing its connections) that sends [token] as the bearer. */
fun OkHttpClient.withBearer(token: String): OkHttpClient =
    newBuilder()
        .addInterceptor { chain ->
            chain.proceed(
                chain
                    .request()
                    .newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build(),
            )
        }.build()

/**
 * The app's one HTTP client: no cookies (the bearer is the only credential), 30-second timeouts,
 * and the app's language on every request so the API answers in it.
 */
fun apiHttpClient(configure: OkHttpClient.Builder.() -> Unit = {}): OkHttpClient =
    OkHttpClient
        .Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(AcceptLanguage)
        .apply(configure)
        .build()

private val AcceptLanguage =
    Interceptor { chain ->
        chain.proceed(
            chain
                .request()
                .newBuilder()
                .header("Accept-Language", Locale.getDefault().toLanguageTag())
                .build(),
        )
    }
