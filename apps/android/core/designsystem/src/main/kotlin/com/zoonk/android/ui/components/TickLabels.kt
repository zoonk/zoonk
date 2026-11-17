package com.zoonk.android.ui.components

fun fittingTickIndices(
    frames: List<Pair<Float, Float>>,
    gap: Float = 4f,
    keepEnds: Boolean = true,
): List<Int> {
    val last = frames.lastIndex
    if (last < 1) return frames.indices.toList()
    val step =
        (1..last).firstOrNull { step ->
            val kept = frames.filterIndexed { index, _ -> index % step == 0 }
            (!keepEnds || last % step == 0) && kept.zipWithNext().all { (a, b) -> a.second + gap <= b.first }
        } ?: if (keepEnds) last else frames.size
    return frames.indices.filter { it % step == 0 }
}
