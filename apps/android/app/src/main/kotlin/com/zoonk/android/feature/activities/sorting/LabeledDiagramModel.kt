package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer

internal data class DiagramSlot(
    val key: String,
    val label: String,
    val number: Int,
)

/** Core's `spotNumber`: the picture numbers its parts from 1, in the parts' order. */
internal fun diagramSlots(labels: List<String>): List<DiagramSlot> =
    labels.mapIndexed { index, label ->
        DiagramSlot(
            "${index + 1}",
            label,
            index + 1,
        )
    }

/** Puts [name] on [key], taking it off any other spot and sending the spot's old name back. */
internal fun placeName(
    placements: Map<String, String>,
    key: String,
    name: String,
): Map<String, String> = placements.filter { (spot, placed) -> spot != key && placed != name } + (key to name)

internal fun nextEmptySlot(
    slots: List<DiagramSlot>,
    after: String?,
    placements: Map<String, String>,
): String? {
    val start = slots.indexOfFirst { it.key == after } + 1
    return (slots.drop(start) + slots.take(start)).firstOrNull { it.key !in placements }?.key
}

internal fun unplacedNames(
    names: List<String>,
    placements: Map<String, String>,
): List<String> = names.filter { it !in placements.values }

internal fun diagramAnswer(
    slots: List<DiagramSlot>,
    placements: Map<String, String>,
): ActivityAnswer? = if (slots.all { it.key in placements }) assignmentAnswer(placements) else null

/** The writer's note for the exact mix-up the learner made, if they wrote one. */
internal fun mixUpFeedback(
    correct: String,
    placed: String?,
    mixUps: List<Pair<String, List<String>>>,
): String? {
    if (placed == null || placed == correct) return null
    return mixUps.firstOrNull { (_, labels) -> placed in labels && correct in labels }?.first
}
