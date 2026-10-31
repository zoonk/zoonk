package com.zoonk.android.data

import com.zoonk.api.ApiServices
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import java.util.Locale
import java.util.concurrent.TimeUnit

/** [baseUrl] is the API's versioned root, ending in `/v1/`. */
class ApiClients(
    val baseUrl: HttpUrl,
    val http: OkHttpClient,
) {
    val streamingHttp: OkHttpClient = http.newBuilder().readTimeout(120, TimeUnit.SECONDS).build()

    private val regular = Memo(http)
    private val streaming = Memo(streamingHttp)

    fun clients(session: AuthenticatedSession?): ApiServices = regular[session]

    /** For writes the server answers slowly, such as grading an essay with a model. */
    fun streamingClients(session: AuthenticatedSession?): ApiServices = streaming[session]

    /** For a token that isn't a session yet. */
    fun bearer(token: String): ApiServices = ApiServices(baseUrl, http.withBearer(token))

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
