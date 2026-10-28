package com.zoonk.android.data

import android.content.Context
import androidx.datastore.core.CorruptionException
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.Serializer
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.dataStoreFile
import androidx.datastore.tink.AeadSerializer
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.security.GeneralSecurityException

/** What the encrypted session file holds. */
@Serializable
data class SessionFile(
    val session: StoredSession? = null,
)

/**
 * Keeps the bearer token in app-private DataStore, encrypted with AES-256-GCM under a Tink keyset
 * that an Android Keystore key wraps. Backup and device transfer exclude it. If the file can't be
 * decrypted (the Keystore key was lost) it's reset, which signs the learner out.
 */
class EncryptedSessionCredentials(
    private val context: Context,
) : SessionCredentials {
    // Keystore work is slow, so the store is made on first use, off the main thread.
    private val store by lazy {
        DataStoreFactory.create(
            serializer = AeadSerializer(aead(), SessionFileSerializer, "zoonk-session".encodeToByteArray()),
            corruptionHandler = ReplaceFileCorruptionHandler { SessionFile() },
            scope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
            produceFile = { context.dataStoreFile("session.pb") },
        )
    }

    override suspend fun read(): StoredSession? = withContext(Dispatchers.IO) { store.data.first().session }

    override suspend fun write(session: StoredSession?) {
        withContext(Dispatchers.IO) { store.updateData { it.copy(session = session) } }
    }

    private fun aead(): Aead {
        AeadConfig.register()
        val keyset =
            try {
                keysetManager()
            } catch (e: GeneralSecurityException) {
                startOver()
            } catch (e: IOException) {
                startOver()
            }
        return keyset.keysetHandle.getPrimitive(RegistryConfiguration.get(), Aead::class.java)
    }

    /** The Keystore key that wraps the keyset is gone: a new keyset, and the old file resets. */
    private fun startOver(): AndroidKeysetManager {
        context.deleteSharedPreferences(KEYSET_PREFERENCES)
        return keysetManager()
    }

    private fun keysetManager() =
        AndroidKeysetManager
            .Builder()
            .withSharedPref(context, "session_keyset", KEYSET_PREFERENCES)
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://zoonk_session_key")
            .build()

    private object SessionFileSerializer : Serializer<SessionFile> {
        private val json = Json { ignoreUnknownKeys = true }

        override val defaultValue = SessionFile()

        override suspend fun readFrom(input: InputStream): SessionFile =
            try {
                json.decodeFromString(SessionFile.serializer(), input.readBytes().decodeToString())
            } catch (e: SerializationException) {
                throw CorruptionException("Unreadable session", e)
            }

        override suspend fun writeTo(
            t: SessionFile,
            output: OutputStream,
        ) {
            output.write(json.encodeToString(SessionFile.serializer(), t).encodeToByteArray())
        }
    }

    private companion object {
        const val KEYSET_PREFERENCES = "zoonk_session_keyset"
    }
}
