package com.zoonk.android.feature.mindmaps

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.KeptRows
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Saves
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.models.SavedMindMap
import com.zoonk.api.models.SavedMindMapState
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
 * to study again, and saving a picture where the learner chose ([files] opens it, from the application's content
 * resolver).
 */
class MindMapViewModel(
    private val store: MindMapStore,
    private val session: AuthenticatedSession,
    private val goalId: UUID,
    private val currentSession: () -> AuthenticatedSession?,
    private val files: (Uri) -> OutputStream? = { null },
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val keptSaved = KeptRows<SavedMindMap, MindMapTarget> { it.target }

    /** This visit to the screen that saves: what its saves lead to is said only on it. */
    val visit = Visit(onEnd = keptSaved::clear)

    /** Whether a picture was written where the learner chose, which the screen says in the app's snackbars. */
    val pictureSaved = visit.outcome<PictureSave>()

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

    /** The chapter each map's save reads again: a lesson map's lives in its chapter's lesson maps. */
    private val chapterOf = mutableMapOf<MindMapTarget, UUID?>()

    private val mapSaves =
        Saves<MindMapTarget>(viewModelScope, visit) { target, saved -> store.save(goalId, target, chapterOf[target], saved).saved() }

    /** A map's save that didn't, which the screen says in the app's snackbars. */
    val saveFailed get() = mapSaves.failed

    /** Each map the learner saved or removed on this visit, as it shows now; the reads say the rest. */
    val saves: StateFlow<Map<MindMapTarget, Boolean>> = mapSaves.states

    /** Shows [saved] at once and sends it; quick taps end on the last one, and a failure shows the reads again and says so. */
    fun save(
        target: MindMapTarget,
        chapterId: UUID?,
        saved: Boolean,
    ) {
        chapterOf[target] = chapterId
        mapSaves.set(target, saved)
    }

    /** The saved maps as [served] lists them now, with each one saved or removed on this visit where it showed. */
    fun savedShown(
        served: List<SavedMindMap>,
        states: Map<MindMapTarget, Boolean>,
    ): List<SavedMindMap> = keptSaved.arrange(served) { it in states }

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

    /**
     * Writes to the file the learner picked at [to] only for the session that asked, and says nothing once it ended; what
     * it wrote is said only on the visit that asked, though the file is written after the screen went too.
     */
    fun savePicture(
        url: String,
        to: Uri,
    ) {
        val started = visit.number
        viewModelScope.launch {
            val bytes = store.picture(session, url)
            if (!isCurrent) return@launch
            val written = bytes != null && withContext(io) { isCurrent && write(to, bytes) }
            if (isCurrent) pictureSaved.send(started, if (written) PictureSave.Saved else PictureSave.Failed)
        }
    }

    private val isCurrent get() = currentSession() == session

    override fun onCleared() = stopWatching()

    private fun write(
        to: Uri,
        bytes: ByteArray,
    ): Boolean =
        try {
            files(to)?.use { it.write(bytes) } != null
        } catch (e: IOException) {
            false
        } catch (e: SecurityException) {
            false
        }

    private companion object {
        const val MAX_MISSES = 3
    }
}

private fun MutationResult<SavedMindMapState>.saved(): MutationResult<Boolean> =
    when (this) {
        is MutationResult.Done -> MutationResult.Done(value.saved)
        is MutationResult.Failed -> this
        MutationResult.Obsolete -> MutationResult.Obsolete
    }
