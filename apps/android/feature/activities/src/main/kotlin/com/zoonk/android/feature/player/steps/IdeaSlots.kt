package com.zoonk.android.feature.player.steps

/**
 * Where a lesson-map idea sits around the map's center, as main places it: [column] -1 on the start
 * side, 0 in the middle and 1 on the end side, and [row] counted from the center's row, 0. Ideas fill
 * the slots in reading order, so TalkBack reads them in their numbers' order.
 */
internal data class IdeaSlot(
    val column: Int,
    val row: Int,
)

/**
 * With three or more ideas the first two sit above the center, the rest below in pairs, and a last
 * idea without a pair is centered. The strip's drawing, the opening map and the end mind map all
 * place ideas this way, so an idea keeps its place from the first screen to the last.
 */
internal fun ideaSlots(count: Int): List<IdeaSlot> {
    val above = if (count > IDEAS_ABOVE_CENTER) IDEAS_ABOVE_CENTER else 0
    val below = count - above

    return List(count) { index ->
        val at = index - above
        when {
            index < above -> IdeaSlot(if (index == 0) -1 else 1, -1)
            at == below - 1 && below % 2 == 1 -> IdeaSlot(0, 1 + at / 2)
            else -> IdeaSlot(if (at % 2 == 0) -1 else 1, 1 + at / 2)
        }
    }
}

/** The rows the slots span, the center's row included. */
internal fun slotRows(slots: List<IdeaSlot>): IntRange =
    minOf(0, slots.minOfOrNull { it.row } ?: 0)..maxOf(0, slots.maxOfOrNull { it.row } ?: 0)

private const val IDEAS_ABOVE_CENTER = 2
