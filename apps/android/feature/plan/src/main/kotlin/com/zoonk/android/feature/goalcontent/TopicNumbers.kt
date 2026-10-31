package com.zoonk.android.feature.goalcontent

// JavaScript's `\s` (main's patterns) also matches no-break and other Unicode spaces, which notices use.
private const val SPACE = "[\\p{IsWhite_Space}\\uFEFF]"
private const val NOT_SPACE = "[^\\p{IsWhite_Space}\\uFEFF]"

/** "1", "1.1", "5.7.": a notice's item number, never a year opening a topic ("2026 in numbers"). */
private val ITEM_NUMBER = Regex("^$SPACE*(\\d{1,3}(?:\\.\\d{1,3})*)\\.?$SPACE+($NOT_SPACE.*)$", RegexOption.DOT_MATCHES_ALL)

/** A sub-item's code some notices write instead of a number: ENEM's "H18 - Identify…". */
private val ITEM_CODE = Regex("^$SPACE*([A-Z]{1,3}\\d{1,3})$SPACE*[-–—:]$SPACE+($NOT_SPACE.*)$", RegexOption.DOT_MATCHES_ALL)

/** "Area competency 1 – Understand the sciences…": the label, then the words. */
private val NAMED_ITEM = Regex("^([^–—:-]{2,40}?$SPACE\\d{1,3})$SPACE*[-–—:]$SPACE+($NOT_SPACE.*)$", RegexOption.DOT_MATCHES_ALL)

internal data class NumberedTopic(
    val depth: Int,
    val number: String?,
    val text: String,
)

internal fun splitTopicNumber(name: String): NumberedTopic {
    ITEM_NUMBER.matchEntire(name)?.let { match ->
        val number = match.groupValues[1]
        return NumberedTopic(depth = number.split('.').size - 1, number = number, text = match.groupValues[2])
    }
    ITEM_CODE.matchEntire(name)?.let { match ->
        return NumberedTopic(depth = 1, number = match.groupValues[1], text = match.groupValues[2])
    }
    return NumberedTopic(depth = 0, number = null, text = name)
}

/** A notice's topic without its item number, for sentences. */
fun toTopicWords(name: String): String = splitTopicNumber(name).text

internal data class TopicChild<T>(
    val topic: T,
    val depth: Int,
    val number: String?,
    val text: String,
)

internal data class TopicGroup<T>(
    val topic: T,
    val number: String?,
    val text: String,
    val children: List<TopicChild<T>>,
)

/** Each top-level item with the sub-items under it, depths counted from the list's top level. */
internal fun <T> groupTopics(
    topics: List<T>,
    name: (T) -> String,
): List<TopicGroup<T>> {
    val split = topics.map { splitTopicNumber(name(it)) to it }
    val top = split.minOfOrNull { it.first.depth } ?: return emptyList()
    val heads = split.indices.filter { it == 0 || split[it].first.depth <= top }

    return heads.mapIndexed { position, start ->
        val (head, topic) = split[start]
        val end = heads.getOrNull(position + 1) ?: split.size
        TopicGroup(
            topic = topic,
            number = head.number,
            text = head.text,
            children = split.subList(start + 1, end).map { (item, child) -> TopicChild(child, item.depth - top, item.number, item.text) },
        )
    }
}

internal data class NamedItem(
    val label: String?,
    val text: String,
)

internal fun splitNamedItem(text: String): NamedItem =
    NAMED_ITEM.matchEntire(text)?.let { NamedItem(label = it.groupValues[1], text = it.groupValues[2]) }
        ?: NamedItem(label = null, text = text)
