package com.zoonk.android.feature.mindmaps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.api.models.MindMapAllowanceStop
import com.zoonk.api.models.MindMapCreateOffer
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
import kotlin.time.toJavaInstant

enum class PictureSave { Saved, Failed }

/** What making every chapter map at once got: on its way, or a server out of reach. */
enum class CreateAll { Pending, Unreachable }

/**
 * What a tap's answer said keeps any new map from starting, shown over the offer the list reads
 * (main's `bulk.stop`): it holds through the read its tap started, and a later list read that says
 * a map can start retires it. Every other Create would be refused the same way, so the page offers none.
 */
sealed interface PageStop {
    /** The read mark when it was kept: reads started after it are later. */
    val since: Long

    /** Create all started none: its answer's stop, as received. */
    data class Answered(
        val stop: MindMapAllowanceStop,
        override val since: Long,
    ) : PageStop

    /** A row's Create was refused for the plan's cap on maps. */
    data class Refused(
        val limit: Limit.Reached,
        override val since: Long,
    ) : PageStop
}

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
    private val pictureSaved: (PictureSave) -> Unit = {},
    private val io: CoroutineDispatcher = Dispatchers.IO,
) : ViewModel() {
    private val locals = MutableStateFlow<Map<UUID, MindMapLocal>>(emptyMap())
    val requests: StateFlow<Map<UUID, MindMapLocal>> = locals.asStateFlow()

    private val all = MutableStateFlow<CreateAll?>(null)
    val createAll: StateFlow<CreateAll?> = all.asStateFlow()

    private val kept = MutableStateFlow<PageStop?>(null)
    val pageStop: StateFlow<PageStop?> = kept.asStateFlow()

    /** The read mark when Create all last failed: a list read started after it clears the failure. */
    @Volatile private var createAllFailedSince = Long.MAX_VALUE

    private val stopWatching =
        store.watchReads(goalId) { chapterIds, started, offer ->
            locals.update { current -> current.filterNot { (id, local) -> id in chapterIds && !local.pending && local.since < started } }
            if (offer != null && createAllFailedSince < started) all.compareAndSet(CreateAll.Unreachable, null)
            if (offer != null && offer.letsOneStart()) kept.update { stop -> stop?.takeUnless { it.since < started } }
        }

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
            val started = store.createAll(goalId)
            if (started == MindMapsStarted.Unreachable) createAllFailedSince = store.readMark()
            (started as? MindMapsStarted.Answered)?.stop?.let { kept.value = PageStop.Answered(it, store.readMark()) }
            all.value = if (started == MindMapsStarted.Unreachable) CreateAll.Unreachable else null
        }
    }

    /** Create and Try again. */
    fun create(chapterId: UUID) {
        if (locals.value[chapterId]?.pending == true) return
        locals.update { it + (chapterId to MindMapLocal(pending = true)) }

        viewModelScope.launch {
            val local =
                when (val created = store.create(ChapterKey(goalId, chapterId))) {
                    null, MindMapCreated.Read -> {
                        null
                    }

                    MindMapCreated.Unreachable -> {
                        MindMapLocal(unreachable = true, since = store.readMark())
                    }

                    is MindMapCreated.Refused -> {
                        val since = store.readMark()
                        (created.limit as? Limit.Reached)
                            ?.takeIf { created.subject == LimitSubject.MindMaps }
                            ?.let { kept.value = PageStop.Refused(it, since) }
                        MindMapLocal(limit = created.limit, subject = created.subject, since = since)
                    }
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
            if (isCurrent) pictureSaved(if (written) PictureSave.Saved else PictureSave.Failed)
        }
    }

    private val isCurrent get() = currentSession() == session

    override fun onCleared() = stopWatching()

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

/** When the page's stop gave its day, as received; null without one. */
internal val PageStop.availableAt: java.time.Instant?
    get() =
        when (this) {
            is PageStop.Answered -> stop.availableAt?.toJavaInstant()
            is PageStop.Refused -> limit.availableAt
        }

/** Main's `startsNoMap`, turned: at least one map can start, or nothing stops one. */
private fun MindMapCreateOffer.letsOneStart(): Boolean = startable > 0 || stop == null
