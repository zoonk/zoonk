package com.zoonk.android.data

import android.content.Context
import coil3.ImageLoader
import coil3.network.NetworkHeaders
import coil3.network.httpHeaders
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient

/**
 * Build each request from the session the screen shows, so a session change changes the request
 * and Coil cancels the old one. Private files are kept in memory per session, never on disk.
 */
class PrivateImages(
    apiBaseUrl: HttpUrl,
    val loader: ImageLoader,
) {
    private val files =
        apiBaseUrl
            .newBuilder()
            .addPathSegment("files")
            .addPathSegment("")
            .build()

    fun isPrivate(url: HttpUrl): Boolean =
        url.scheme == files.scheme && url.host == files.host && url.port == files.port && url.encodedPath.startsWith(files.encodedPath)

    fun request(
        context: Context,
        url: String,
        session: AuthenticatedSession?,
    ): ImageRequest {
        val parsed = url.toHttpUrlOrNull()
        val builder = ImageRequest.Builder(context)
        if (parsed == null || !isPrivate(parsed)) return builder.data(url).build()
        session ?: return builder.data(null).build()
        return builder
            .data(url)
            .httpHeaders(NetworkHeaders.Builder().set("Authorization", "Bearer ${session.bearerToken}").build())
            .memoryCacheKeyExtra(SESSION_KEY, session.localId)
            .diskCachePolicy(CachePolicy.DISABLED)
            .build()
    }

    fun forget(session: AuthenticatedSession) {
        val cache = loader.memoryCache ?: return
        cache.keys.filter { it.extras[SESSION_KEY] == session.localId }.forEach(cache::remove)
    }

    private companion object {
        const val SESSION_KEY = "session"
    }
}

fun imageLoader(
    context: Context,
    http: OkHttpClient,
): ImageLoader =
    ImageLoader
        .Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { http.newBuilder().build() })) }
        .build()
