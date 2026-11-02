package com.zoonk.android.feature.activities.sorting

import kotlin.math.max
import kotlin.math.min

internal data class CauseLink(
    val from: String,
    val to: String,
)

internal enum class LinkState { Made, Correct, Incorrect, Missed }

internal data class LinkResult(
    val link: CauseLink,
    val state: LinkState,
)

/** Dated nodes in time order; with a node undated, the writer's order. */
internal fun <T> orderNodes(
    nodes: List<T>,
    year: (T) -> Long?,
): List<T> = if (nodes.all { year(it) != null }) nodes.sortedBy { year(it) } else nodes

internal fun List<CauseLink>.toggle(link: CauseLink): List<CauseLink> = if (link in this) this - link else this + link

internal fun compareLinks(
    learner: List<CauseLink>,
    expected: List<CauseLink>,
): List<LinkResult> =
    learner.map { LinkResult(it, if (it in expected) LinkState.Correct else LinkState.Incorrect) } +
        expected.filter { it !in learner }.map { LinkResult(it, LinkState.Missed) }

/** How far, in dp, an arc bows away from the cards: further for cards further apart, within the gutter. */
internal fun arcDepth(span: Int): Float = min(ARC_BASE + ARC_STEP * max(span - 1, 0), ARC_GUTTER - 2)

internal const val ARC_GUTTER = 48f
private const val ARC_BASE = 14f
private const val ARC_STEP = 7f
