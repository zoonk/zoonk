package com.zoonk.android.feature.mindmaps

/** A tab's rows under the subject they teach; [name] is null for a goal whose subjects have no pages. */
data class IndexGroup<T>(
    val key: String,
    val name: String?,
    val rows: List<T>,
)

/** What a tab's index shows, in order. */
sealed interface IndexEntry<out T> {
    /** A subject's title; [open] is null while every subject shows its rows, else whether this one does. */
    data class Subject(
        val key: String,
        val name: String,
        val count: Int,
        val open: Boolean?,
    ) : IndexEntry<Nothing>

    data class Row<T>(
        val row: T,
    ) : IndexEntry<T>

    /** "Show all N" under the first rows of a long list without subjects. */
    data class ShowAll(
        val count: Int,
    ) : IndexEntry<Nothing>
}

/** Rows a tab shows in full before its subjects fold, or before a list without them shows only its first. */
const val INDEX_OPEN_UP_TO = 12
const val INDEX_FIRST_ROWS = 8

/**
 * A tab's bounded index: every subject open while the tab has [INDEX_OPEN_UP_TO] rows or fewer, past
 * that each folded to its title unless in [opened]; without subjects, the first [INDEX_FIRST_ROWS]
 * rows and "Show all N" until [showAll].
 */
fun <T> boundedIndex(
    groups: List<IndexGroup<T>>,
    opened: Set<String>,
    showAll: Boolean,
): List<IndexEntry<T>> {
    val total = groups.sumOf { it.rows.size }
    val unnamed = groups.filter { it.name == null }.flatMap { it.rows }
    val named = groups.filter { it.name != null && it.rows.isNotEmpty() }
    val folds = total > INDEX_OPEN_UP_TO

    return buildList {
        val shown = if (showAll || unnamed.size <= INDEX_FIRST_ROWS || named.isNotEmpty()) unnamed else unnamed.take(INDEX_FIRST_ROWS)
        shown.forEach { add(IndexEntry.Row(it)) }
        if (shown.size < unnamed.size) add(IndexEntry.ShowAll(unnamed.size))

        named.forEach { group ->
            val open = !folds || group.key in opened
            add(IndexEntry.Subject(group.key, group.name.orEmpty(), group.rows.size, if (folds) open else null))
            if (open) group.rows.forEach { add(IndexEntry.Row(it)) }
        }
    }
}
