package com.zoonk.android.feature.goalcontent

import com.zoonk.api.models.GoalContentGoal
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusChapter
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.SyllabusTopic

/** Language units and single-course paths keep the plan's path; exams and multi-module plans have subject pages. */
val Syllabus.hasSubjectPages: Boolean
    get() = goal.kind != GoalContentGoal.Kind.LANGUAGE && (kind == Syllabus.Kind.NOTICE || subjects.size > 1)

/** Shares from 0 to 1: an exam subject's preparation, or its lessons studied and known. */
data class SubjectBar(
    val studied: Double,
    val known: Double,
) {
    val share: Double get() = (studied + known).coerceIn(0.0, 1.0)
}

val SyllabusSubject.bar: SubjectBar
    get() {
        val preparation = preparation
        return when {
            preparation != null -> SubjectBar(studied = preparation, known = 0.0)
            lessonsTotal == 0L -> SubjectBar(studied = 0.0, known = 0.0)
            else -> SubjectBar(studied = lessonsDone.toDouble() / lessonsTotal, known = lessonsKnown.toDouble() / lessonsTotal)
        }
    }

internal data class SubjectCoverage(
    val studied: Double,
    val known: Double,
    val new: Double,
)

internal val SyllabusSubject.coverage: SubjectCoverage
    get() {
        if (lessonsTotal == 0L) return SubjectCoverage(studied = 0.0, known = 0.0, new = 1.0)
        val studied = (lessonsDone.toDouble() / lessonsTotal).coerceAtMost(1.0)
        val known = (lessonsKnown.toDouble() / lessonsTotal).coerceAtMost(1 - studied)
        return SubjectCoverage(studied = studied, known = known, new = (1 - studied - known).coerceAtLeast(0.0))
    }

internal data class SubjectGroup(
    val extra: Boolean,
    val name: String?,
    val subjects: List<SyllabusSubject>,
)

/** The notice's groups in its order, then the areas the plan adds outside it; a plan's modules are one group. */
internal fun groupSubjects(
    subjects: List<SyllabusSubject>,
    modules: Boolean,
): List<SubjectGroup> {
    if (modules) return listOf(SubjectGroup(extra = false, name = null, subjects = subjects))

    fun key(subject: SyllabusSubject) = if (subject.source == SyllabusSubject.Source.PLAN) null else subject.group.orEmpty()

    return subjects
        .map(::key)
        .distinct()
        .sortedBy { it == null }
        .map { key ->
            val inGroup = subjects.filter { key(it) == key }
            SubjectGroup(extra = key == null, name = if (key == null) null else inGroup.first().group, subjects = inGroup)
        }
}

/** "Appears a lot" on every row tells nothing, so it only marks rows when it sets some apart. */
internal fun setsApart(frequencies: List<SyllabusTopic.Frequency?>): Boolean {
    val frequent = frequencies.count { it == SyllabusTopic.Frequency.HIGH }
    return frequent > 0 && frequent < frequencies.size
}

internal data class HeadingRun(
    val heading: String?,
    val topics: List<SyllabusTopic>,
)

/** Topics the notice lists under one heading come together, in order. */
internal fun splitByHeading(topics: List<SyllabusTopic>): List<HeadingRun> =
    topics.fold(emptyList()) { runs, topic ->
        val last = runs.lastOrNull()
        if (last != null && last.heading == topic.heading) {
            runs.dropLast(1) + last.copy(topics = last.topics + topic)
        } else {
            runs + HeadingRun(topic.heading, listOf(topic))
        }
    }

internal sealed interface TopicMark {
    data object Studied : TopicMark

    data object Known : TopicMark

    data object ToStudy : TopicMark

    data object NotPlanned : TopicMark

    data class InProgress(
        val share: Double,
    ) : TopicMark
}

private fun chaptersShare(chapters: List<SyllabusChapter>): Double {
    val total = chapters.sumOf { it.lessonsTotal }
    return if (total > 0) chapters.sumOf { it.lessonsDone }.toDouble() / total else 0.0
}

internal val SyllabusTopic.mark: TopicMark?
    get() =
        when (status) {
            null -> null
            SyllabusTopic.Status.STUDIED -> TopicMark.Studied
            SyllabusTopic.Status.KNOWN -> TopicMark.Known
            SyllabusTopic.Status.TO_STUDY -> TopicMark.ToStudy
            SyllabusTopic.Status.NOT_PLANNED -> TopicMark.NotPlanned
            SyllabusTopic.Status.IN_PROGRESS -> TopicMark.InProgress(chaptersShare(chapters))
        }

internal val TopicGroup<SyllabusTopic>.items: List<SyllabusTopic>
    get() = listOf(topic) + children.map { it.topic }

internal val TopicGroup<SyllabusTopic>.mark: TopicMark?
    get() {
        val topics = items
        if (topics.any { it.status == null }) return null

        val planned = topics.filter { it.status != SyllabusTopic.Status.NOT_PLANNED }
        val known = planned.count { it.status == SyllabusTopic.Status.KNOWN }
        val studied = planned.count { it.status == SyllabusTopic.Status.STUDIED || it.status == SyllabusTopic.Status.KNOWN }
        val begun = planned.count { it.status == SyllabusTopic.Status.IN_PROGRESS }

        return when {
            planned.isEmpty() -> TopicMark.NotPlanned
            known == planned.size -> TopicMark.Known
            studied == planned.size -> TopicMark.Studied
            studied + begun == 0 -> TopicMark.ToStudy
            else -> TopicMark.InProgress((studied + begun / 2.0) / planned.size)
        }
    }

/** Its topics studied (or known) of all of them; null for a single topic or one without a status. */
internal val TopicGroup<SyllabusTopic>.studiedCount: Pair<Int, Int>?
    get() {
        val topics = items
        if (children.isEmpty() || topics.any { it.status == null }) return null
        return topics.count { it.status == SyllabusTopic.Status.STUDIED || it.status == SyllabusTopic.Status.KNOWN } to topics.size
    }

internal val TopicGroup<SyllabusTopic>.chapters: List<SyllabusChapter>
    get() = items.flatMap { it.chapters }.distinctBy { it.chapterId?.toString() ?: it.title }

internal val TopicGroup<SyllabusTopic>.frequency: SyllabusTopic.Frequency?
    get() = if (items.any { it.frequency == SyllabusTopic.Frequency.HIGH }) SyllabusTopic.Frequency.HIGH else null

/** The chapter Continue opens: the first not done with a page, unless the subject is out of the plan. */
internal val SyllabusSubject.nextChapterId
    get() =
        if (notPlannedReason !=
            null
        ) {
            null
        } else {
            chapters.firstOrNull { it.state != SyllabusChapter.State.DONE && it.chapterId != null }?.chapterId
        }
