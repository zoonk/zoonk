package com.zoonk.android.feature.mindmaps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
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

/** What making every chapter map at once got: on its way, or a server out of reach. */
enum class CreateAll { Pending, Unreachable }

/**
 * A screen's mind maps for one session: making one, or all of them, only from a tap, following one
 * while it's on its way (every 4 seconds while drawing, every 15 while its lessons are written,
 * giving up after three misses in a row; the server fails a run that stops reporting), saving a map
 * to study again, and saving a picture where the learner chose.
 */
class MindMapViewModel(
    private val store: MindMapStore,
    private val session: AuthenticatedSession,
    private val goalId: UUID,
    private val currentSession: () -> AuthenticatedSession?,
    private val saveFailed: () -> Unit = {},
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val locals = MutableStateFlow<Map<UUID, MindMapLocal>>(emptyMap())
    val requests: StateFlow<Map<UUID, MindMapLocal>> = locals.asStateFlow()

    private val all = MutableStateFlow<CreateAll?>(null)
    val createAll: StateFlow<CreateAll?> = all.asStateFlow()

    /** The read mark when Create all last failed: a list read started after it clears the failure. */
    @Volatile private var createAllFailedSince = Long.MAX_VALUE

    private val stopWatching =
        store.watchReads(goalId) { chapterIds, started, wholeList ->
            locals.update { current -> current.filterNot { (id, local) -> id in chapterIds && !local.pending && local.since < started } }
            if (wholeList && createAllFailedSince < started) all.compareAndSet(CreateAll.Unreachable, null)
        }

    private val saved = MutableStateFlow<PictureSave?>(null)
    val save: StateFlow<PictureSave?> = saved.asStateFlow()

    private val wanted = MutableStateFlow<Map<MindMapTarget, Boolean>>(emptyMap())

    /** What the learner asked for each map whose save is on its way; the reads say the rest. */
    val saves: StateFlow<Map<MindMapTarget, Boolean>> = wanted.asStateFlow()
    private val sending = mutableSetOf<MindMapTarget>()

    /**
     * Shows [saved] at once and sends it. Taps while one is on its way only change what's wanted,
     * and the last one wanted is sent after it, so the server ends on the learner's last tap. A
     * failure shows the reads again and says so.
     */
    fun save(
        target: MindMapTarget,
        chapterId: UUID?,
        saved: Boolean,
    ) {
        wanted.update { it + (target to saved) }
        if (!sending.add(target)) return

        viewModelScope.launch {
            while (true) {
                val sent = wanted.value[target] ?: break
                val result = store.save(goalId, target, chapterId, sent)
                if (result !is MutationResult.Done) {
                    wanted.update { it - target }
                    if (result is MutationResult.Failed) saveFailed()
                    break
                }
                if (wanted.value[target] == sent) {
                    wanted.update { it - target }
                    break
                }
            }
            sending.remove(target)
        }
    }

    /** Create all chapter maps: the list, read again, shows them on their way. */
    fun createAll() {
        if (all.value == CreateAll.Pending) return
        all.value = CreateAll.Pending
        viewModelScope.launch {
            val failed = store.createAll(goalId) == false
            if (failed) createAllFailedSince = store.readMark()
            all.value = if (failed) CreateAll.Unreachable else null
        }
    }

    /** Create and Try again. */
    fun create(chapterId: UUID) {
        if (locals.value[chapterId]?.pending == true) return
        locals.update { it + (chapterId to MindMapLocal(pending = true)) }

        viewModelScope.launch {
            val local =
                when (val created = store.create(ChapterKey(goalId, chapterId))) {
                    null, MindMapCreated.Read -> null
                    MindMapCreated.Unreachable -> MindMapLocal(unreachable = true, since = store.readMark())
                    is MindMapCreated.Refused -> MindMapLocal(limit = created.limit, subject = created.subject, since = store.readMark())
                }
            locals.update { if (local == null) it - chapterId else it + (chapterId to local) }
        }
    }

    /**
     * Runs while the screen shows the map on its way ([shown]): asks where the run stands, reads the
     * map again whenever the reads show otherwise, and ends once they show it ended. It never writes
     * what a status said, since an answer can land after a newer read (Plus bought meanwhile). A
     * status or a read that fails, or reads that still disagree, count as a miss; three in a row say
     * the server is out of reach.
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

            if (status != null && store.agrees(key, status)) {
                if (!status.onItsWay) return
                waiting = status
                misses = 0
            } else if (++misses >= MAX_MISSES) {
                locals.update { it + (chapterId to MindMapLocal(unreachable = true, since = store.readMark())) }
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

    override fun onCleared() = stopWatching()

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
