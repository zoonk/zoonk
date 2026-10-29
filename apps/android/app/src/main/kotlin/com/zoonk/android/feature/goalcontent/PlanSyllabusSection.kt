package com.zoonk.android.feature.goalcontent

import android.icu.text.ListFormatter
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.api.models.GoalContentGoal
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusCourseWeights
import com.zoonk.api.models.SyllabusSubject

/**
 * The Plan's structure (main's `SyllabusSection`): an exam's subjects or the plan's modules, grouped
 * as the notice groups them, each with its progress and opening its page through [onOpenSubject]
 * with the subject's key. Show it only when [hasSubjectPages].
 */
@Composable
fun PlanSyllabusSection(
    syllabus: Syllabus,
    onOpenSubject: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val groups = groupSubjects(syllabus.subjects, modules = syllabus.kind == Syllabus.Kind.MODULES)
    val exam = syllabus.goal.kind == GoalContentGoal.Kind.EXAM

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val layout =
            when {
                maxWidth >= QUESTIONS_FROM -> RowLayout.WithQuestions
                maxWidth >= BAR_BESIDE_FROM -> RowLayout.BarBeside
                else -> RowLayout.Stacked
            }
        val barWidth = (maxWidth * BAR_SHARE).coerceIn(BAR_MIN, BAR_MAX)

        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = PAGE_PADDING),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(if (exam) R.string.goalcontent_subjects else R.string.goalcontent_modules),
                    modifier = Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                )
                if (exam) {
                    Text(
                        stringResource(R.string.goalcontent_preparation),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium,
                    )
                } else {
                    Row(Modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LegendItem(LegendDot.Studied, stringResource(R.string.goalcontent_studied))
                        LegendItem(LegendDot.Known, stringResource(R.string.goalcontent_known))
                        LegendItem(LegendDot.New, stringResource(R.string.goalcontent_new))
                    }
                }
            }

            groups.forEach { group ->
                val name = if (group.extra) beyondGroupName(syllabus) else group.name
                if (name != null) {
                    Text(
                        text = name,
                        modifier =
                            Modifier
                                .padding(
                                    start = PAGE_PADDING,
                                    end = PAGE_PADDING,
                                    top = 16.dp,
                                    bottom = 4.dp,
                                ).semantics { heading() },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                group.subjects.forEachIndexed { index, subject ->
                    if (index > 0) RowDivider()
                    SubjectRow(subject, layout, barWidth, onClick = { onOpenSubject(subject.key) })
                }
            }

            QuestionsSourceNote(syllabus, sectionCount(syllabus), Modifier.padding(top = 12.dp))
            CourseWeightsNote(syllabus.subjects, syllabus.courseWeights, Modifier.padding(top = 8.dp))
        }
    }
}

private enum class RowLayout { Stacked, BarBeside, WithQuestions }

@Composable
private fun SubjectRow(
    subject: SyllabusSubject,
    layout: RowLayout,
    barWidth: Dp,
    onClick: () -> Unit,
) {
    val notPlanned = subject.notPlannedReason != null
    val bar = if (notPlanned) null else subject.bar
    val share = bar?.share ?: subject.preparation
    val locale = currentLocale()
    val questions = subject.questions?.takeIf { it > 0 }?.toInt()

    val name: @Composable (Modifier) -> Unit = { nameModifier ->
        Text(
            text = subject.name,
            modifier = nameModifier,
            color = if (notPlanned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            maxLines = if (layout == RowLayout.Stacked) Int.MAX_VALUE else 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
    val progress: @Composable (Modifier) -> Unit = { progressModifier ->
        if (bar != null) {
            CoverageBar(studied = bar.studied, known = bar.known, modifier = progressModifier)
        } else {
            Text(
                stringResource(R.string.goalcontent_not_in_plan),
                progressModifier,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }

    ListRow(modifier = Modifier.padding(horizontal = PAGE_PADDING), onClick = onClick, end = { ListRowChevron() }) {
        if (layout == RowLayout.Stacked) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                name(Modifier)
                progress(Modifier)
            }
        } else {
            name(Modifier.weight(1f))
            if (layout == RowLayout.WithQuestions) {
                Text(
                    text = questions?.let { pluralStringResource(R.plurals.goalcontent_question_count, it, it) }.orEmpty(),
                    modifier = Modifier.width(QUESTIONS_WIDTH),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = factsStyle(),
                    textAlign = TextAlign.End,
                    maxLines = 1,
                )
            }
            progress(Modifier.width(barWidth))
        }
        Text(
            text = share?.let { formatProgressShare(it, locale) }.orEmpty(),
            modifier = Modifier.widthIn(min = SHARE_WIDTH),
            color = if (notPlanned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            style = factsStyle(),
            textAlign = TextAlign.End,
        )
    }
}

/** How much the section holds, as the plan's reveal counted it: the notice's own subjects, not the plan's extras. */
@Composable
private fun sectionCount(syllabus: Syllabus): String {
    val subjects = syllabus.subjects.count { it.source == SyllabusSubject.Source.NOTICE }
    val topics = syllabus.topicCount.toInt()

    return when {
        syllabus.fromMaterial -> {
            val count = if (topics > 0) topics else subjects
            pluralStringResource(R.plurals.goalcontent_material_topic_count, count, count)
        }

        syllabus.kind == Syllabus.Kind.NOTICE && topics > 0 -> {
            listOf(
                pluralStringResource(R.plurals.goalcontent_subject_count, subjects, subjects),
                pluralStringResource(R.plurals.goalcontent_topic_count, topics, topics),
            ).joinToString(" · ")
        }

        syllabus.goal.kind == GoalContentGoal.Kind.EXAM -> {
            val count = if (syllabus.kind == Syllabus.Kind.NOTICE) subjects else syllabus.subjects.size
            pluralStringResource(R.plurals.goalcontent_subject_count, count, count)
        }

        else -> {
            pluralStringResource(R.plurals.goalcontent_module_count, syllabus.subjects.size, syllabus.subjects.size)
        }
    }
}

@Composable
private fun QuestionsSourceNote(
    syllabus: Syllabus,
    lead: String,
    modifier: Modifier = Modifier,
) {
    val source = syllabus.questionsSource
    if (source == null) {
        SectionNote(annotate(lead), modifier)
        return
    }
    val publisher = sourceHost(source.url)
    val edition = source.edition
    val sentence =
        if (edition != null) {
            stringResource(R.string.goalcontent_questions_source_edition, edition, publisher)
        } else {
            stringResource(R.string.goalcontent_questions_source_latest, publisher)
        }

    SectionNote(annotate("$lead · $sentence", publisher to LinkTarget(source.url)), modifier)
}

/** How the learner's course weighs the exam's parts, which the plan's time follows. */
@Composable
private fun CourseWeightsNote(
    subjects: List<SyllabusSubject>,
    weights: SyllabusCourseWeights?,
    modifier: Modifier = Modifier,
) {
    val source = weights?.source ?: return
    val publisher = sourceHost(source.url)
    val lightest = weights.subjects.minOfOrNull { it.weight } ?: return
    val heavier =
        weights.subjects
            .filter { it.weight > lightest }
            .map { part -> subjects.firstOrNull { it.name == part.name }?.shortName ?: part.name }

    val text =
        if (heavier.isEmpty()) {
            stringResource(R.string.goalcontent_course_weights_even, weights.course, weights.institution, publisher)
        } else {
            val parts = ListFormatter.getInstance(currentLocale()).format(heavier)
            stringResource(R.string.goalcontent_course_weights_heavier, weights.course, weights.institution, parts, publisher)
        }

    SectionNote(annotate(text, publisher to LinkTarget(source.url)), modifier)
}

/** Main's container widths: the bar beside the name from 32rem, the question count too from 42rem. */
private val BAR_BESIDE_FROM = 512.dp
private val QUESTIONS_FROM = 672.dp
private const val BAR_SHARE = 0.3f
private val BAR_MIN = 112.dp
private val BAR_MAX = 224.dp
private val QUESTIONS_WIDTH = 104.dp
private val SHARE_WIDTH = 40.dp
