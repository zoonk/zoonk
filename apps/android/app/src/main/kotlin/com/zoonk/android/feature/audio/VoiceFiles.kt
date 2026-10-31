package com.zoonk.android.feature.audio

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.SessionSource
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest

/**
 * Clips download once into the app's cache folder, which the system may clear when space runs low.
 * A private file (the learner's own clip) is kept in its session's folder, removed by [forget], and
 * only while that session is current.
 */
class VoiceFiles(
    private val directory: File,
    private val http: OkHttpClient,
    private val isPrivate: (HttpUrl) -> Boolean,
    private val sessions: SessionSource,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    /**
     * Throws [ApiException]; [session] is sent only to the API's own files. Call it on the main
     * thread, where [forget] runs, so a private file is never kept after its session ended.
     */
    suspend fun file(
        url: String,
        session: AuthenticatedSession?,
    ): File {
        val parsed = url.toHttpUrlOrNull() ?: throw ApiException(ApiError.Unavailable)
        val owner = session?.takeIf { isPrivate(parsed) }
        if (owner == null && isPrivate(parsed)) throw ApiException(ApiError.Unauthorized)
        val folder = owner?.let { File(directory, it.localId) } ?: directory
        val file = File(folder, name(parsed))
        val partial = withContext(io) { if (file.exists()) null else download(parsed, owner) } ?: return file
        try {
            if (owner != null && sessions.current != owner) throw ApiException(ApiError.Unauthorized)
            folder.mkdirs()
            if (!partial.renameTo(file)) throw ApiException(ApiError.Unavailable)
        } finally {
            partial.delete()
        }
        return file
    }

    private fun download(
        url: HttpUrl,
        owner: AuthenticatedSession?,
    ): File {
        val request =
            Request
                .Builder()
                .url(url)
                .apply { owner?.let { header("Authorization", "Bearer ${it.bearerToken}") } }
                .build()
        directory.mkdirs()
        val partial = File.createTempFile("clip", ".part", directory)
        try {
            http.newCall(request).execute().use { response ->
                if (response.code == 401) throw ApiException(ApiError.Unauthorized)
                if (!response.isSuccessful) throw ApiException(ApiError.Unavailable)
                partial.outputStream().use { response.body.byteStream().copyTo(it) }
            }
            return partial
        } catch (e: Exception) {
            partial.delete()
            if (e is IOException) throw ApiException(ApiError.Network)
            throw e
        }
    }

    fun forget(session: AuthenticatedSession) {
        File(directory, session.localId).deleteRecursively()
    }

    private fun name(url: HttpUrl): String {
        val hash =
            MessageDigest
                .getInstance("SHA-256")
                .digest(url.toString().toByteArray())
                .joinToString("") { "%02x".format(it) }
        val extension = url.pathSegments.last().substringAfterLast('.', "mp3")
        return "$hash.$extension"
    }
}
