package com.zoonk.android.feature.activities.reasoning

internal data class ExcerptPassage(
    val id: String,
    val text: String,
)

/** A run of an excerpt: a passage's own text, or the plain text between passages (no [passageId]). */
internal data class ExcerptSegment(
    val passageId: String?,
    val text: String,
)

private data class PassageRange(
    val id: String,
    val start: Int,
    val end: Int,
)

/** Core's `splitExcerpt`: each passage at its first exact occurrence; a later passage that overlaps an earlier one stays plain. */
internal fun splitExcerpt(
    excerpt: String,
    passages: List<ExcerptPassage>,
): List<ExcerptSegment> {
    val located =
        passages
            .filter { it.text.isNotEmpty() }
            .mapNotNull { passage ->
                excerpt.indexOf(passage.text).takeIf { it != -1 }?.let {
                    PassageRange(
                        passage.id,
                        it,
                        it + passage.text.length,
                    )
                }
            }.sortedBy { it.start }
    val ranges = mutableListOf<PassageRange>()
    located.forEach { if (it.start >= (ranges.lastOrNull()?.end ?: 0)) ranges += it }

    val segments =
        ranges.flatMapIndexed { index, range ->
            val before = excerpt.substring(ranges.getOrNull(index - 1)?.end ?: 0, range.start)
            listOfNotNull(
                ExcerptSegment(null, before).takeIf { before.isNotEmpty() },
                ExcerptSegment(range.id, excerpt.substring(range.start, range.end)),
            )
        }
    val rest = excerpt.substring(ranges.lastOrNull()?.end ?: 0)
    return if (rest.isEmpty()) segments else segments + ExcerptSegment(null, rest)
}
