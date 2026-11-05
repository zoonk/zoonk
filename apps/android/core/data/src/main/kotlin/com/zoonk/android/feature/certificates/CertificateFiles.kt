package com.zoonk.android.feature.certificates

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest

/**
 * A certificate's public pictures as files in the app's cache, which the share sheet and printing
 * read through the app's file provider ([AUTHORITY_SUFFIX]). A renamed learner's pictures have new
 * URLs, so each URL keeps its own folder.
 */
class CertificateFiles(
    private val directory: File,
    private val http: OkHttpClient,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    /** Throws [ApiException]. [name] is what the learner sees, such as "Ana Souza - Python - Zoonk.png". */
    suspend fun file(
        url: String,
        name: String,
    ): File =
        withContext(io) {
            val folder = File(directory, hash(url))
            val file = File(folder, name)
            if (!file.exists()) {
                folder.mkdirs()
                val partial = File.createTempFile("picture", ".part", folder)
                try {
                    download(url, partial)
                    if (!partial.renameTo(file)) throw ApiException(ApiError.Unavailable)
                } finally {
                    partial.delete()
                }
            }
            file
        }

    private fun download(
        url: String,
        into: File,
    ) {
        try {
            http.newCall(Request.Builder().url(url).build()).execute().use { response ->
                if (!response.isSuccessful) throw ApiException(ApiError.Unavailable)
                into.outputStream().use { response.body.byteStream().copyTo(it) }
            }
        } catch (_: IOException) {
            throw ApiException(ApiError.Network)
        } catch (_: IllegalArgumentException) {
            throw ApiException(ApiError.Unavailable)
        }
    }

    private fun hash(url: String) =
        MessageDigest
            .getInstance("SHA-256")
            .digest(url.toByteArray())
            .joinToString("") { "%02x".format(it) }

    companion object {
        /** Added to the app's id, as the manifest's file provider declares it. */
        const val AUTHORITY_SUFFIX = ".files"
    }
}
