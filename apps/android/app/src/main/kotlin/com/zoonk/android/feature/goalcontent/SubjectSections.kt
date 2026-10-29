package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.WrittenCadenceChoice
import com.zoonk.android.feature.plan.formatPlanDate
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusChapter
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.SyllabusTopic
import com.zoonk.api.models.WrittenPractice
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlinx.datetime.LocalDate as KotlinLocalDate

/**
 * An exam subject out of the plan keeps its preparation, since the exam still tests it; any other
 * subject out of it has nothing.
 */
@Composable
internal fun SubjectCoverage(
    subject: SyllabusSubject,
    modifier: Modifier = Modifier,
    labelled: Boolean = false,
) {
    val preparation = subject.preparation
    val locale = currentLocale()

    if (preparation != null) {
        Column(modifier.padding(horizontal = PAGE_PADDING), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (labelled) {
                Text(
                    stringResource(R.string.goalcontent_preparation),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Text(
                text = formatProgressShare(preparation, locale),
                style = MaterialTheme.typography.displaySmall.copy(fontFeatureSettings = "tnum"),
            )
            CoverageBar(studied = preparation)
            Column {
                Text(stringResource(R.string.goalcontent_mastery), style = MaterialTheme.typography.labelLarge)
                val mastery = subject.mastery
                Text(
                    text =
                        if (mastery == null) {
                            stringResource(R.string.goalcontent_mastery_pending)
                        } else {
                            stringResource(
                                R.string.goalcontent_mastery_right,
                                formatNumber(mastery.correct.toDouble(), locale),
                                formatNumber(mastery.answered.toDouble(), locale),
                            )
                        },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = factsStyle(),
                )
            }
        }
        return
    }

    if (subject.notPlannedReason != null) return

    val coverage = subject.coverage
    Column(modifier.padding(horizontal = PAGE_PADDING), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CoverageBar(studied = coverage.studied, known = coverage.known)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LegendItem(LegendDot.Studied, stringResource(R.string.goalcontent_studied), formatProgressShare(coverage.studied, locale))
            LegendItem(LegendDot.Known, stringResource(R.string.goalcontent_known), formatProgressShare(coverage.known, locale))
            LegendItem(LegendDot.New, stringResource(R.string.goalcontent_new), formatProgressShare(coverage.new, locale))
        }
    }
}

internal enum class LegendDot { Studied, Known, New }

@Composable
internal fun LegendItem(
    dot: LegendDot,
    label: String,
    value: String? = null,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        LegendMark(dot)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        if (value != null) Text(value, style = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum"))
    }
}

@Composable
private fun LegendMark(dot: LegendDot) {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
    val modifier = Modifier.size(6.dp)
    when (dot) {
        LegendDot.Studied -> FilledDot(MaterialTheme.colorScheme.tertiary, modifier)
        LegendDot.Known -> FilledDot(quiet, modifier)
        LegendDot.New -> Box(modifier.border(1.dp, quiet, CircleShape))
    }
}

@Composable
internal fun NotPlannedNotice(
    subject: SyllabusSubject,
    writes: SubjectWrites,
    actions: SubjectActions,
) {
    val words =
        when (subject.notPlannedReason) {
            SyllabusSubject.NotPlannedReason.SKIPPED -> R.string.goalcontent_subject_skipped
            SyllabusSubject.NotPlannedReason.TIME -> R.string.goalcontent_subject_time
            SyllabusSubject.NotPlannedReason.MISSING -> R.string.goalcontent_subject_missing
            else -> return
        }

    OutlinedCard(Modifier.fillMaxWidth().padding(start = PAGE_PADDING, end = PAGE_PADDING, top = 20.dp)) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painter = painterResource(R.drawable.ic_do_not_disturb_on),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(words), style = MaterialTheme.typography.bodyMedium)

                when (subject.notPlannedReason) {
                    SyllabusSubject.NotPlannedReason.SKIPPED -> {
                        FilledTonalButton(onClick = { actions.restore(subject.areas) }, enabled = !writes.restoring) {
                            Text(stringResource(R.string.goalcontent_bring_back))
                        }
                        if (writes.restoreFailed) SaveFailed()
                    }

                    SyllabusSubject.NotPlannedReason.TIME -> {
                        TextButton(onClick = actions.adjustPlan) { Text(stringResource(R.string.goalcontent_adjust_plan)) }
                    }

                    else -> {}
                }
            }
        }
    }
}

@Composable
private fun SaveFailed() {
    Text(
        text = stringResource(R.string.goalcontent_save_failed),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** When the exam's written tests are practiced, on a written test's own page. */
@Composable
internal fun SubjectWrittenPractice(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    writes: SubjectWrites,
    actions: SubjectActions,
) {
    val practice = syllabus.writtenPractice ?: return
    if (subject.areas.none { it in practice.parts }) return

    WrittenCadenceChoice(
        practice = practice,
        asked = writes.tappedCadence,
        pending = writes.tappedCadence != null,
        failed = writes.cadenceFailed,
        onChange = actions.setCadence,
        modifier = Modifier.padding(start = PAGE_PADDING, end = PAGE_PADDING, top = 20.dp),
    )
}

/** Main's subject aside, from 72rem: its coverage and its details. */
@Composable
internal fun ColumnScope.SubjectAside(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    today: LocalDate,
    openMindMaps: (() -> Unit)?,
    ask: (@Composable (AskTutorAppearance) -> Unit)?,
) {
    if (subject.notPlannedReason == null || subject.preparation != null) {
        AsideSection(
            stringResource(if (subject.preparation == null) R.string.goalcontent_coverage else R.string.goalcontent_preparation),
        ) { SubjectCoverage(subject) }
    }

    AsideSection(stringResource(R.string.goalcontent_details)) { SubjectDetails(syllabus, subject, today) }

    if (openMindMaps != null || ask != null) {
        AsideSection(stringResource(R.string.goalcontent_also)) {
            Column {
                if (openMindMaps != null) MindMapsRow(openMindMaps)
                ask?.invoke(AskTutorAppearance.Row)
            }
        }
    }
}

/** The goal's mind maps, where this subject's finished chapters have theirs. */
@Composable
internal fun MindMapsRow(onClick: () -> Unit) {
    ContentRow(
        headline = { Text(stringResource(R.string.navigation_mind_maps)) },
        onClick = onClick,
        leading = { Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { KindDot(LearnKind.MindMap) } },
    )
}

@Composable
private fun SubjectDetails(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    today: LocalDate,
) {
    val locale = currentLocale()

    fun number(value: Number) = formatNumber(value.toDouble(), locale)
    val questions = subject.questions?.takeIf { it > 0 }
    val edition = syllabus.questionsSource?.edition
    val nextDate = subject.nextDate

    Column {
        if (questions != null) {
            PropertyRow(stringResource(R.string.goalcontent_questions), listOfNotNull(number(questions), edition).joinToString(" · "))
        }
        if (subject.topics.isNotEmpty()) {
            PropertyRow(
                stringResource(R.string.goalcontent_topics),
                stringResource(R.string.goalcontent_count_of, number(subject.topicsStudied ?: 0), number(subject.topics.size)),
            )
        }
        if (subject.chapters.isNotEmpty()) {
            val done = subject.chapters.count { it.state == SyllabusChapter.State.DONE }
            PropertyRow(
                stringResource(R.string.goalcontent_chapters),
                stringResource(R.string.goalcontent_count_of, number(done), number(subject.chapters.size)),
            )
        }
        if (nextDate != null) {
            PropertyRow(stringResource(R.string.goalcontent_next_date), formatPlanDate(nextDate.toJavaLocalDate(), today, locale))
        }
        if (subject.lessonsKnown > 0) {
            val known = subject.lessonsKnown.toInt()
            PropertyRow(
                stringResource(R.string.goalcontent_known_before),
                pluralStringResource(R.plurals.goalcontent_lessons_skipped, known, known),
            )
        }
    }
}

internal fun LazyListScope.subjectChapters(
    subject: SyllabusSubject,
    today: LocalDate,
    actions: SubjectActions,
) {
    val chapters = subject.chapters
    if (chapters.isEmpty()) return

    val done = chapters.filter { it.state == SyllabusChapter.State.DONE }
    val studied = done.count { !it.known }
    val ahead = chapters.filter { it.state != SyllabusChapter.State.DONE }

    sectionTitle(
        key = "chapters-title",
        title = { stringResource(R.string.goalcontent_chapters) },
        detail = {
            val locale = currentLocale()
            stringResource(
                R.string.goalcontent_count_of,
                formatNumber(studied.toDouble(), locale),
                formatNumber(chapters.size.toDouble(), locale),
            )
        },
    )

    if (done.isNotEmpty()) {
        item(key = "chapters-done", contentType = "expandable") {
            var expanded by rememberSaveable { mutableStateOf(false) }
            ExpandableRow(
                expanded = expanded,
                onToggle = { expanded = !expanded },
                headline = { Text(doneLine(done), color = MaterialTheme.colorScheme.onSurfaceVariant) },
                leading = {
                    StatusMark(if (done.all { it.known }) MarkStatus.Skipped else MarkStatus.Done)
                },
            ) {
                Column {
                    done.forEach { chapter ->
                        RowDivider()
                        SyllabusChapterRow(chapter, today, actions)
                    }
                }
            }
        }
    }

    item(key = "chapters-ahead", contentType = "chapters-ahead") {
        var showAll by rememberSaveable { mutableStateOf(false) }
        val shown = if (showAll) ahead else ahead.take(SHOWN_UPCOMING + 1)
        val hidden = ahead.size - shown.size

        Column {
            shown.forEachIndexed { index, chapter ->
                if (index > 0 || done.isNotEmpty()) RowDivider()
                SyllabusChapterRow(chapter, today, actions)
            }
            if (hidden > 0) {
                RowDivider()
                ContentRow(
                    headline = {
                        Text(
                            pluralStringResource(R.plurals.goalcontent_more_chapters, hidden, hidden),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    onClick = { showAll = true },
                    leading = {
                        Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) {
                            Icon(
                                painterResource(R.drawable.ic_add),
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun doneLine(chapters: List<SyllabusChapter>): String {
    val known = chapters.count { it.known }
    val done = chapters.size - known
    return when {
        known == 0 -> {
            pluralStringResource(R.plurals.goalcontent_chapters_done, done, done)
        }

        done == 0 -> {
            pluralStringResource(R.plurals.goalcontent_chapters_known, known, known)
        }

        else -> {
            stringResource(
                R.string.goalcontent_done_and_known,
                pluralStringResource(R.plurals.goalcontent_chapters_done, done, done),
                pluralStringResource(R.plurals.goalcontent_chapters_known_after_done, known, known),
            )
        }
    }
}

@Composable
internal fun SyllabusChapterRow(
    chapter: SyllabusChapter,
    today: LocalDate,
    actions: SubjectActions,
) {
    val isNext = chapter.state == SyllabusChapter.State.CURRENT
    val chapterId = chapter.chapterId
    val openFarTopic = actions.openFarTopic
    val onClick =
        when {
            chapterId != null -> {
                { actions.openChapter(chapterId) }
            }

            chapter.writing && chapter.skillId != null && openFarTopic != null -> {
                { openFarTopic(chapter) }
            }

            else -> {
                null
            }
        }
    val quiet = chapter.state == SyllabusChapter.State.DONE || onClick == null
    val line = chapterLine(chapter)
    val nextDate = chapter.nextDate?.takeIf { chapter.state != SyllabusChapter.State.DONE }
    val locale = currentLocale()

    ContentRow(
        headline = {
            Text(
                text = numberedTitle(chapter.position, chapter.title),
                color = if (quiet) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        },
        onClick = onClick,
        current = isNext,
        leading = { ChapterMark(chapter, isNext) },
        supporting = line?.let { { Text(it) } },
        trailing = nextDate?.let { { Text(formatPlanDate(it.toJavaLocalDate(), today, locale), style = factsStyle()) } },
    )
}

@Composable
private fun chapterLine(chapter: SyllabusChapter): String? =
    when {
        chapter.known -> {
            stringResource(R.string.goalcontent_skipped_known)
        }

        chapter.writing -> {
            writingLine(chapter.far, chapter.plannedLessons, nextDate = null)
        }

        chapter.state == SyllabusChapter.State.CURRENT -> {
            val total = chapter.lessonsTotal.toInt()
            stringResource(
                R.string.goalcontent_lessons_done,
                pluralStringResource(R.plurals.goalcontent_lesson_count, total, total),
                formatNumber(chapter.lessonsDone.toDouble(), currentLocale()),
            )
        }

        else -> {
            null
        }
    }

/** A topic not written yet: a far one says how many lessons and from when, any other that they're on the way. */
@Composable
internal fun writingLine(
    far: Boolean,
    lessons: Long?,
    nextDate: KotlinLocalDate?,
): String? {
    if (!far) return stringResource(R.string.goalcontent_lessons_on_the_way)

    val start = nextDate?.let { formatStart(it.toJavaLocalDate(), LocalDate.now(), currentLocale()) }
    if (lessons == null) return start?.let { stringResource(R.string.goalcontent_from_start, it) }

    val count = lessons.toInt()
    val words =
        if (count == 1) {
            pluralStringResource(R.plurals.goalcontent_lesson_count, 1, 1)
        } else {
            pluralStringResource(R.plurals.goalcontent_about_lessons, count, count)
        }
    return if (start == null) words else stringResource(R.string.goalcontent_lessons_from_start, words, start)
}

internal fun LazyListScope.subjectTopics(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    actions: SubjectActions,
) {
    val topics = subject.topics
    val showFrequency = setsApart(topics.map { it.frequency })

    sectionTitle(
        key = "topics-title",
        title = {
            stringResource(
                when {
                    syllabus.fromMaterial -> R.string.goalcontent_topics_in_material
                    syllabus.examDocument == ExamDocument.NOTICE -> R.string.goalcontent_topics_in_notice
                    else -> R.string.goalcontent_topics_in_guide
                },
            )
        },
        detail = {
            val studied = subject.topicsStudied
            if (studied == null) {
                pluralStringResource(R.plurals.goalcontent_topic_count, topics.size, topics.size)
            } else {
                pluralStringResource(
                    R.plurals.goalcontent_topics_studied_of,
                    topics.size,
                    formatNumber(studied.toDouble(), currentLocale()),
                    topics.size,
                )
            }
        },
    )

    splitByHeading(topics).forEachIndexed { runIndex, run ->
        if (run.heading != null) {
            item(key = "heading-$runIndex", contentType = "heading") {
                SectionLabel(run.heading, Modifier.padding(top = 16.dp, bottom = 4.dp))
            }
        }
        groupTopics(run.topics) { it.name }.forEachIndexed { index, group ->
            item(key = "topic-$runIndex-$index", contentType = "topic") {
                Column {
                    if (index > 0) RowDivider()
                    TopicGroupRow(group, showFrequency, syllabus.knownTopicsReturn, actions)
                }
            }
        }
    }

    item(key = "topics-note", contentType = "note") {
        TopicFrequencyNote(syllabus.fromMaterial, subject, Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun TopicGroupRow(
    group: TopicGroup<SyllabusTopic>,
    showFrequency: Boolean,
    knownReturn: Syllabus.KnownTopicsReturn,
    actions: SubjectActions,
) {
    val mark = group.mark
    val chapters = group.chapters
    val status = topicMarkWords(mark)
    val headline: @Composable () -> Unit = {
        TitleWithChip(chip = if (showFrequency && group.frequency == SyllabusTopic.Frequency.HIGH) ({ FrequencyChip() }) else null) {
            Text(
                text = numberedTopic(group.number, group.text),
                color =
                    if (mark ==
                        TopicMark.NotPlanned
                    ) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
            )
        }
    }
    val supporting: (@Composable () -> Unit)? =
        if (group.children.isEmpty()) topicNote(group.topic, knownReturn)?.let { note -> { Text(note) } } else null
    val trailing: (@Composable () -> Unit)? = group.studiedCount?.let { (studied, total) -> { GroupCount(studied, total) } }
    val leading: @Composable () -> Unit = { TopicMarkIcon(mark) }

    if (group.children.isEmpty() && chapters.isEmpty()) {
        ContentRow(headline = headline, leading = leading, supporting = supporting, trailing = trailing, stateDescription = status)
        return
    }

    var expanded by rememberSaveable { mutableStateOf(false) }
    ExpandableRow(
        expanded = expanded,
        onToggle = { expanded = !expanded },
        headline = headline,
        leading = leading,
        supporting = supporting,
        trailing = trailing,
        stateDescription = status,
    ) {
        Column(Modifier.padding(start = TOPIC_CONTENT_START, end = PAGE_PADDING, bottom = 8.dp)) {
            group.children.forEach { child -> ChildTopic(child, knownReturn) }
            if (chapters.isNotEmpty()) {
                if (group.children.isNotEmpty()) HorizontalDivider(Modifier.padding(vertical = 4.dp))
                chapters.forEach { TopicChapterLink(it, actions) }
            }
        }
    }
}

@Composable
private fun GroupCount(
    studied: Int,
    total: Int,
) {
    val locale = currentLocale()
    val spoken = pluralStringResource(R.plurals.goalcontent_topics_studied_spoken, total, formatNumber(studied.toDouble(), locale), total)
    Text(
        text = "${formatNumber(studied.toDouble(), locale)}/${formatNumber(total.toDouble(), locale)}",
        modifier = Modifier.clearAndSetSemantics { contentDescription = spoken },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum"),
    )
}

@Composable
private fun ChildTopic(
    child: TopicChild<SyllabusTopic>,
    knownReturn: Syllabus.KnownTopicsReturn,
) {
    val mark = child.topic.mark
    val status = topicMarkWords(mark)
    val note = topicNote(child.topic, knownReturn)

    Row(
        modifier =
            Modifier
                .padding(start = CHILD_INDENT * (child.depth - 1).coerceIn(0, 2), top = 6.dp, bottom = 6.dp)
                .semantics(mergeDescendants = true) { if (status != null) stateDescription = status },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TopicMarkIcon(mark, small = true)
        Column(Modifier.weight(1f)) {
            Text(
                text = numberedTopic(child.number, child.text),
                color =
                    if (mark ==
                        TopicMark.NotPlanned
                    ) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                style = MaterialTheme.typography.bodyMedium,
            )
            if (note != null) {
                Text(note, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TopicChapterLink(
    chapter: SyllabusChapter,
    actions: SubjectActions,
) {
    val chapterId = chapter.chapterId
    val openFarTopic = actions.openFarTopic
    val onClick =
        when {
            chapterId != null -> {
                { actions.openChapter(chapterId) }
            }

            chapter.writing && chapter.skillId != null && openFarTopic != null -> {
                { openFarTopic(chapter) }
            }

            else -> {
                null
            }
        }
    val line = if (chapterId == null) writingLine(chapter.far, chapter.plannedLessons, chapter.nextDate) else null

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .then(if (onClick == null) Modifier else Modifier.clickable(onClick = onClick)),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painterResource(R.drawable.ic_menu_book),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = chapter.title,
            modifier = Modifier.weight(1f).padding(vertical = 4.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (line != null) Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        if (chapterId != null) {
            Icon(
                painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun numberedTopic(
    number: String?,
    text: String,
) = buildAnnotatedString {
    if (number != null) {
        withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant, fontFeatureSettings = "tnum")) { append("$number ") }
    }
    append(text)
}

@Composable
private fun topicNote(
    topic: SyllabusTopic,
    knownReturn: Syllabus.KnownTopicsReturn,
): String? {
    if (topic.status == SyllabusTopic.Status.KNOWN) {
        return stringResource(
            if (knownReturn ==
                Syllabus.KnownTopicsReturn.REVIEWS
            ) {
                R.string.goalcontent_topic_known_reviews
            } else {
                R.string.goalcontent_topic_known_practice
            },
        )
    }
    return when (topic.notPlannedReason) {
        null -> null
        SyllabusTopic.NotPlannedReason.SKIPPED -> stringResource(R.string.goalcontent_topic_skipped)
        SyllabusTopic.NotPlannedReason.PAST_BASICS -> stringResource(R.string.goalcontent_topic_past_basics)
        SyllabusTopic.NotPlannedReason.SKIPPED_BASE -> stringResource(R.string.goalcontent_topic_skipped_base)
        SyllabusTopic.NotPlannedReason.TIME -> stringResource(R.string.goalcontent_topic_time)
        SyllabusTopic.NotPlannedReason.MISSING -> stringResource(R.string.goalcontent_topic_missing)
    }
}

@Composable
private fun TopicFrequencyNote(
    fromMaterial: Boolean,
    subject: SyllabusSubject,
    modifier: Modifier = Modifier,
) {
    val source = subject.topicFrequencySource
    val tagged = setsApart(subject.topics.map { it.frequency })
    val mark = stringResource(R.string.goalcontent_appears_a_lot)
    val markStyle = frequencyMarkStyle()

    val text =
        when {
            fromMaterial && tagged -> {
                annotate(stringResource(R.string.goalcontent_frequency_material, mark), mark to markStyle)
            }

            fromMaterial -> {
                null
            }

            source == null && tagged -> {
                annotate(stringResource(R.string.goalcontent_frequency_past_exams, mark), mark to markStyle)
            }

            source == null -> {
                null
            }

            else -> {
                val publisher = sourceHost(source.url)
                val link = publisher to LinkTarget(source.url)
                val waits = subject.topics.any { it.notPlannedReason == SyllabusTopic.NotPlannedReason.TIME }
                when {
                    tagged && waits -> {
                        annotate(
                            stringResource(R.string.goalcontent_frequency_tagged_waits, mark, source.basis, publisher),
                            mark to markStyle,
                            link,
                        )
                    }

                    tagged -> {
                        annotate(
                            stringResource(R.string.goalcontent_frequency_tagged, mark, source.basis, publisher),
                            mark to markStyle,
                            link,
                        )
                    }

                    waits -> {
                        annotate(stringResource(R.string.goalcontent_frequency_waits, source.basis, publisher), link)
                    }

                    else -> {
                        annotate(stringResource(R.string.goalcontent_frequency_most, source.basis, publisher), link)
                    }
                }
            }
        }

    if (text != null) SectionNote(text, modifier)
}

internal fun LazyListScope.subjectMatrix(matrix: List<String>) {
    if (matrix.isEmpty()) return

    val groups = groupTopics(matrix) { it }
    val skills = groups.sumOf { it.children.size.coerceAtLeast(1) }

    sectionTitle(
        key = "matrix-title",
        title = { stringResource(R.string.goalcontent_matrix_title) },
        detail = { pluralStringResource(R.plurals.goalcontent_skill_count, skills, skills) },
    )

    item(key = "matrix", contentType = "matrix") {
        var showAll by rememberSaveable { mutableStateOf(false) }
        val shown = if (showAll) groups else groups.take(SHOWN_MATRIX_GROUPS)

        Column {
            shown.forEachIndexed { index, group ->
                if (index > 0) RowDivider()
                MatrixGroupRow(group)
            }
            if (groups.size > shown.size) {
                RowDivider()
                ContentRow(
                    headline = {
                        Text(
                            stringResource(R.string.goalcontent_see_all, formatNumber(groups.size.toDouble(), currentLocale())),
                        )
                    },
                    onClick = { showAll = true },
                )
            }
        }
    }
}

@Composable
private fun MatrixGroupRow(group: TopicGroup<String>) {
    val named = splitNamedItem(group.text)
    val skills =
        group.children.size
            .takeIf { it > 0 }
            ?.let { pluralStringResource(R.plurals.goalcontent_skill_count, it, it) }
    val line = listOfNotNull(named.label, skills).joinToString(" · ").takeIf { it.isNotEmpty() }
    val headline: @Composable () -> Unit = {
        Text(numberedTopic(group.number, named.text), maxLines = 3, overflow = TextOverflow.Ellipsis)
    }
    val supporting: (@Composable () -> Unit)? = line?.let { { Text(it) } }

    if (group.children.isEmpty()) {
        ContentRow(headline = headline, supporting = supporting)
        return
    }

    var expanded by rememberSaveable { mutableStateOf(false) }
    ExpandableRow(expanded = expanded, onToggle = { expanded = !expanded }, headline = headline, supporting = supporting) {
        Column(
            Modifier.padding(start = PAGE_PADDING, end = PAGE_PADDING, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            group.children.forEach { child ->
                Text(
                    text = numberedTopic(child.number, child.text),
                    modifier = Modifier.padding(start = if (child.depth > 1) CHILD_INDENT else 0.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

private const val SHOWN_UPCOMING = 4
private const val SHOWN_MATRIX_GROUPS = 2

/** Under a row's words, past its mark (ListItem's 16dp, a 24dp mark, its 16dp gap). */
private val TOPIC_CONTENT_START = 56.dp
private val CHILD_INDENT = 20.dp
