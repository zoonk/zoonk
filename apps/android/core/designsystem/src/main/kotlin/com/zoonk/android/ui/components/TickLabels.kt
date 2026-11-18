package com.zoonk.android.ui.components

import androidx.compose.ui.unit.dp

/** How far apart neighbouring tick labels stay, as the web's 4px. */
val TICK_LABEL_GAP = 4.dp

fun fittingTickIndices(
    frames: List<Pair<Float, Float>>,
    gap: Float,
): List<Int> {
    val last = frames.lastIndex
    if (last < 1) return frames.indices.toList()
    val step =
        (1..last).firstOrNull { step ->
            val kept = frames.filterIndexed { index, _ -> index % step == 0 }
            kept.zipWithNext().all { (a, b) -> a.second + gap <= b.first }
        } ?: frames.size
    return frames.indices.filter { it % step == 0 }
}

fun fittingTicks(
    domain: ClosedFloatingPointRange<Double>,
    frame: (Double) -> Pair<Float, Float>,
    values: (Int) -> List<Double> = { niceTicks(domain, it) },
    count: Int = 4,
    gap: Float,
): List<Double> {
    for (density in count downTo 1) {
        val ticks = values(density)
        if (ticks.map(frame).zipWithNext().all { (a, b) -> a.second + gap <= b.first }) return ticks
    }
    return emptyList()
}
