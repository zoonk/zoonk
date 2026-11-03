package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer

internal fun <T> unplacedItems(
    items: List<T>,
    placements: Map<String, String>,
    id: (T) -> String,
): List<T> = items.filter { id(it) !in placements }

/** The answer once every item has a group, in the items' order. */
internal fun placementsAnswer(
    ids: List<String>,
    placements: Map<String, String>,
): ActivityAnswer? = if (ids.all { it in placements }) assignmentAnswer(ids.associateWith { placements.getValue(it) }) else null
