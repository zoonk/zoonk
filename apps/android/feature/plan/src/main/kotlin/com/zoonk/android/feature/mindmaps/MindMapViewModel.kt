package com.zoonk.android.feature.mindmaps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

enum class PictureSave { Saved, Failed }

/**
 * A screen's mind maps for one session: making one only from a tap, following one while it's on its
 * way (every 4 seconds while drawing, every 15 while its lessons are written, giving up after three
 * misses in a row; the server fails a run that stops reporting), and saving a picture where the
 * learner chose.
 */
class MindMapViewModel(
    private val store: MindMapStore,
    private val session: AuthenticatedSession,
    private val goalId: UUID,
    private val currentSession: () -> AuthenticatedSession?,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val locals = MutableStateFlow<Map<UUID, MindMapLocal>>(emptyMap())
    val requests: StateFlow<Map<UUID, MindMapLocal>> = locals.asStateFlow()

    private val saved = MutableStateFlow<PictureSave?>(null)
    val save: StateFlow<PictureSave?> = saved.asStateFlow()

    fun create(chapterId: UUID) {
        if (locals.value[chapterId]?.pending == true) return
        locals.update { it + (chapterId to MindMapLocal(pending = true)) }

        viewModelScope.launch {
            val key = ChapterKey(goalId, chapterId)
            val created = store.create(key)
            val local =
                when (created) {
                    // The lock lives in the store's reads, so a later read (after buying Plus) replaces it.
                    null, MindMapCreated.PlusRequired -> {
                        MindMapLocal()
                    }

                    MindMapCreated.Ready -> {
                        MindMapLocal(shown = MindMapShown.Ready)
                    }

                    is MindMapCreated.OnItsWay -> {
                        MindMapLocal(shown = created.shown)
                    }

                    MindMapCreated.Unavailable -> {
                        MindMapLocal(shown = MindMapShown.Unavailable)
                    }

                    MindMapCreated.Failed -> {
                        MindMapLocal(shown = MindMapShown.Unreachable)
                    }

                    is MindMapCreated.Refused -> {
                        MindMapLocal(shown = MindMapShown.Refused, limit = created.limit, subject = created.subject)
                    }
                }
            locals.update { it + (chapterId to local) }
        }
    }

    /** Try again: follows the map again after the poll got stuck, otherwise asks for it again. */
    fun retry(chapterId: UUID) {
        val local = locals.value[chapterId]
        if (local?.stuck == true) {
            locals.update { it + (chapterId to MindMapLocal(shown = local.shown ?: MindMapShown.Drawing)) }
        } else {
            create(chapterId)
        }
    }

    /**
     * Runs while the screen shows the map on its way ([shown]), until the screen's reads show how it
     * ended, and then leaves the row to them, so a later read (after buying Plus) wins. A status or a
     * read that fails counts as a miss; a stuck poll keeps what it waited on, so Try again follows it
     * at the same pace.
     */
    suspend fun follow(
        chapterId: UUID,
        shown: MindMapShown,
    ) {
        val key = ChapterKey(goalId, chapterId)
        var waiting = shown
        var misses = 0

        while (true) {
            delay(waiting.pollEvery)
            val status = store.status(session, key)?.shown

            when {
                status == null -> {
                    misses++
                }

                status.onItsWay -> {
                    misses = 0
                    if (status != waiting) locals.update { it + (chapterId to MindMapLocal(shown = status)) }
                    waiting = status
                }

                else -> {
                    // A lock or a failure lives in the store's reads: the row stops following once it shows one.
                    val held = store.show(key, status)
                    locals.update { if (held) it - chapterId else it + (chapterId to MindMapLocal(shown = status)) }
                    if (store.reread(key, status)) {
                        locals.update { it - chapterId }
                        return
                    }
                    misses++
                }
            }

            if (misses >= MAX_MISSES) {
                locals.update { it + (chapterId to MindMapLocal(shown = waiting, stuck = true)) }
                return
            }
        }
    }

    /** Writes only for the session that asked, and says nothing once it ended. */
    fun savePicture(
        url: String,
        open: () -> OutputStream?,
    ) {
        viewModelScope.launch {
            val bytes = store.picture(session, url)
            if (!isCurrent) return@launch
            val written = bytes != null && withContext(io) { isCurrent && write(open, bytes) }
            if (isCurrent) saved.value = if (written) PictureSave.Saved else PictureSave.Failed
        }
    }

    private val isCurrent get() = currentSession() == session

    fun savedShown() {
        saved.value = null
    }

    private fun write(
        open: () -> OutputStream?,
        bytes: ByteArray,
    ): Boolean =
        try {
            open()?.use { it.write(bytes) } != null
        } catch (e: IOException) {
            false
        } catch (e: SecurityException) {
            false
        }

    private companion object {
        const val MAX_MISSES = 3
    }
}
