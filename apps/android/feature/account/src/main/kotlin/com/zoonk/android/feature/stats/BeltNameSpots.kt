package com.zoonk.android.feature.stats

/**
 * Where the belts' names go under a row [width] wide of equal columns, as (belt, start) pairs: each centered
 * on its column and kept inside the row. Every name shows when none comes within [gap] of the next;
 * otherwise only the [current] belt's, which then has the room it needs.
 */
internal fun beltNameSpots(
    width: Int,
    names: List<Int>,
    current: Int,
    gap: Int,
): List<Pair<Int, Int>> {
    val column = width.toFloat() / names.size
    val starts =
        names.mapIndexed {
            index,
            name,
            ->
            (column * (index + 0.5f) - name / 2f).toInt().coerceIn(0, (width - name).coerceAtLeast(0))
        }
    val allFit = names.indices.drop(1).all { starts[it - 1] + names[it - 1] + gap <= starts[it] }
    return if (allFit) starts.withIndex().map { it.index to it.value } else listOf(current to starts[current])
}
