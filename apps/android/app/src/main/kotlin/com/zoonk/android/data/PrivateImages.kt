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
 * Pictures of a learner's private courses, chapters and lessons, which the API serves from
 * `/v1/files/` to their owner only. Each request is built from the session the screen shows: the
 * bearer goes into that request alone, the memory cache keeps it under the session's `localId`
 * and the disk cache never does, so the next learner on the device can't see it. When the session
 * changes the screen's request changes, and Coil cancels the old one.
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

    /** Only the API's own files get the session; a public image host never sees it. */
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
        // Signed out, a private picture keeps its fallback artwork.
        session ?: return builder.data(null).build()
        return builder
            .data(url)
            .httpHeaders(NetworkHeaders.Builder().set("Authorization", "Bearer ${session.bearerToken}").build())
            .memoryCacheKeyExtra(SESSION_KEY, session.localId)
            .diskCachePolicy(CachePolicy.DISABLED)
            .build()
    }

    /** Drops [session]'s private pictures from memory once it's no longer current. */
    fun forget(session: AuthenticatedSession) {
        val cache = loader.memoryCache ?: return
        cache.keys.filter { it.extras[SESSION_KEY] == session.localId }.forEach(cache::remove)
    }

    private companion object {
        const val SESSION_KEY = "session"
    }
}

/** The app's one image loader, on a copy of the app's HTTP client so it shares its connections. */
fun imageLoader(
    context: Context,
    http: OkHttpClient,
): ImageLoader =
    ImageLoader
        .Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { http.newBuilder().build() })) }
        .build()
