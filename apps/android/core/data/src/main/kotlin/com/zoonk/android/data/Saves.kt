package com.zoonk.android.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** What a save that didn't go through was asked to do, so the screen words its failure. */
enum class SaveFailure { Save, Remove }

/**
 * One screen's saves of one kind of thing (a map, a lesson), main's `useSaves`: each tap shows at once and is sent as
 * the state the learner wants, one request at a time for each thing, so quick taps end on the last one. What the
 * server stored wins over what the screen was served until [visit] ends; a save that fails goes back, and the
 * failure is owed to the visit it was asked on. A save is sent even once its screen goes, as the learner asked for
 * it. [write] answers whether it's saved now.
 */
class Saves<K : Any>(
    private val scope: CoroutineScope,
    private val visit: Visit,
    private val write: suspend (key: K, saved: Boolean) -> MutationResult<Boolean>,
) {
    val failed = visit.outcome<SaveFailure>()

    private val wanted = MutableStateFlow<Map<K, Boolean>>(emptyMap())
    private val stored = MutableStateFlow<Map<K, Boolean>>(emptyMap())
    private val current = MutableStateFlow<Map<K, Boolean>>(emptyMap())

    /** Each thing the learner changed on this visit, as it shows now: on its way, or as the server stored it. */
    val states: StateFlow<Map<K, Boolean>> = current.asStateFlow()

    private val sending = mutableSetOf<K>()

    /** The visit of the tap each wanted save came from: a write that starts later still belongs to it. */
    private val askedOn = mutableMapOf<K, Int>()

    init {
        visit.opening(onEnd = { change { stored.value = emptyMap() } })
    }

    /** Shows [saved] at once and sends it, after the one on its way when there is one. */
    fun set(
        key: K,
        saved: Boolean,
    ) {
        change { wanted.value += key to saved }
        askedOn[key] = visit.number
        if (!sending.add(key)) return

        scope.launch {
            while (true) {
                val sent = wanted.value[key] ?: break
                val started = askedOn.getValue(key)
                val result = withContext(NonCancellable) { write(key, sent) }
                if (result is MutationResult.Done) {
                    if (started == visit.number) change { stored.value += key to result.value }
                    if (wanted.value[key] != sent) continue
                } else if (result is MutationResult.Failed) {
                    failed.send(started, if (sent) SaveFailure.Save else SaveFailure.Remove)
                }
                change { wanted.value -= key }
                break
            }
            sending.remove(key)
            askedOn.remove(key)
        }
    }

    private inline fun change(edit: () -> Unit) {
        edit()
        current.value = stored.value + wanted.value
    }
}

/** Whether [key] shows as saved: as the learner changed it on this visit, or as the screen was [served]. */
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
