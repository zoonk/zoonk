package com.zoonk.android.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.lang.ref.WeakReference

/** What a save that didn't go through was asked to do, so the screen words its failure. */
enum class SaveFailure { Save, Remove }

/**
 * The app's saves of one kind of thing (a map, a lesson), main's tab saves: each tap shows on every screen at once and
 * is sent as the state the learner wants, one request at a time for each thing whichever screen it was made on, so
 * quick taps end on the last one and what the server took last is what every screen shows. A save is sent even once
 * its screen goes, as the learner asked for it. [scope] is the app's.
 */
class Saves<K : Any>(
    private val scope: CoroutineScope,
) {
    private class Tap(
        val saved: Boolean,
        val asker: SaveVisit<*>,
        val visit: Int,
        val write: suspend (saved: Boolean) -> MutationResult<Boolean>,
    )

    /** Each thing's newest tap while a request for it is out. */
    private val taps = mutableMapOf<K, Tap>()

    /** What the server took last for each thing, until a save of it fails. */
    private val stored = mutableMapOf<K, Boolean>()

    private val visits = mutableListOf<WeakReference<SaveVisit<K>>>()

    /** A screen's [visit] to these saves; [write] sends one and answers whether it's saved now. */
    fun on(
        visit: Visit,
        write: suspend (key: K, saved: Boolean) -> MutationResult<Boolean>,
    ): SaveVisit<K> = SaveVisit(this, visit, write).also { visits += WeakReference(it) }

    internal fun set(
        key: K,
        saved: Boolean,
        asker: SaveVisit<K>,
        visit: Int,
        write: suspend (saved: Boolean) -> MutationResult<Boolean>,
    ) {
        val sending = key in taps
        taps[key] = Tap(saved, asker, visit, write)
        show()
        if (!sending) scope.launch { send(key) }
    }

    /** What [touched] shows of these saves: every tap on its way, and what the server took for the rest. */
    internal fun shown(touched: Set<K>): Map<K, Boolean> = stored.filterKeys { it in touched } + taps.mapValues { it.value.saved }

    private suspend fun send(key: K) {
        while (true) {
            val tap = taps.getValue(key)
            val result = tap.write(tap.saved)
            if (result is MutationResult.Done) {
                stored[key] = result.value
                if (taps.getValue(key).saved != tap.saved) continue
            } else {
                stored -= key
                val newest = taps.getValue(key)
                if (result is MutationResult.Failed) {
                    newest.asker.failed.send(
                        newest.visit,
                        if (tap.saved) SaveFailure.Save else SaveFailure.Remove,
                    )
                }
            }
            break
        }
        taps -= key
        show()
    }

    private fun show() {
        visits.removeAll { it.get()?.show() == null }
    }
}

/**
 * One screen's visit to the app's [Saves], main's `useSaves`: it shows every tap on its way, and what the server took
 * for the things changed on this visit over what the screen was served, until the visit ends. A save that fails goes
 * back, and the failure is owed to the visit of the newest tap.
 */
class SaveVisit<K : Any> internal constructor(
    private val saves: Saves<K>,
    private val visit: Visit,
    private val write: suspend (key: K, saved: Boolean) -> MutationResult<Boolean>,
) {
    val failed = visit.outcome<SaveFailure>()

    private val touched = mutableSetOf<K>()
    private val current = MutableStateFlow(saves.shown(touched))

    /** Each thing that shows otherwise than the screen was served: on its way, or as the server stored it. */
    val states: StateFlow<Map<K, Boolean>> = current.asStateFlow()

    init {
        visit.opening(onEnd = {
            touched.clear()
            show()
        })
    }

    /** Shows [saved] at once and sends it, after the one on its way when there is one. */
    fun set(
        key: K,
        saved: Boolean,
    ) {
        touched += key
        saves.set(key, saved, this, visit.number) { write(key, it) }
    }

    internal fun show() {
        current.value = saves.shown(touched)
    }
}

/** Whether [key] shows as saved: as a visit's [SaveVisit.states] say, or as the screen was [served]. */
fun <K : Any> Map<K, Boolean>.isSaved(
    key: K,
    served: Boolean,
): Boolean = this[key] ?: served

/**
 * Main's `useKeptRows`: a list of saves keeps the rows the learner changed on this visit where they were, until the
 * visit ends ([clear]), so nothing moves under their thumb and a tap saves a removed one again. A newer read drops
 * only the rows removed somewhere else.
 */
class KeptRows<R, K>(
    private val keyOf: (R) -> K,
) {
    private var served: List<R>? = null
    private var shown: List<R> = emptyList()

    /** [rows] as the server lists them now, with every [touched] row in the place it showed. */
    fun arrange(
        rows: List<R>,
        touched: (K) -> Boolean,
    ): List<R> {
        if (rows != served) {
            shown = served?.let { keepRows(shown, rows, keyOf, touched) } ?: rows
            served = rows
        }
        return shown
    }

    fun clear() {
        served = null
        shown = emptyList()
    }
}

/** A list of saves in its two sections: the rows that open, then the ones that can't anymore. */
data class SaveSections<R>(
    val opens: List<R>,
    val gone: List<R>,
)

/**
 * These rows (the read with each kept row back, as [KeptRows.arrange] returns them) split where each one's newest copy
 * says, so a kept row that can no longer open shows only among the gone ones, and only while it's [saved].
 */
fun <R> List<R>.saveSections(
    available: (R) -> Boolean,
    saved: (R) -> Boolean,
): SaveSections<R> = SaveSections(filter(available), filter { !available(it) && saved(it) })

/** [next], with each [touched] row of [previous] back after the row it followed there, in its newest version. */
fun <R, K> keepRows(
    previous: List<R>,
    next: List<R>,
    keyOf: (R) -> K,
    touched: (K) -> Boolean,
): List<R> {
    val held = previous.withIndex().filter { touched(keyOf(it.value)) }
    val heldKeys = held.mapTo(HashSet()) { keyOf(it.value) }
    val newest = next.associateBy(keyOf)
    val merged = next.filterNot { keyOf(it) in heldKeys }.toMutableList()
    held.forEach { (index, row) ->
        val shownKeys = merged.mapTo(HashSet(), keyOf)
        val above = previous.subList(0, index).lastOrNull { keyOf(it) in shownKeys }?.let(keyOf)
        val at = above?.let { key -> merged.indexOfFirst { keyOf(it) == key } + 1 } ?: 0
        merged.add(at, newest[keyOf(row)] ?: row)
    }
    return merged
}
