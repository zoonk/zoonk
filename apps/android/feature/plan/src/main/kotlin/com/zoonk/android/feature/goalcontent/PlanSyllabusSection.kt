package com.zoonk.android.feature.goalcontent

import android.icu.text.ListFormatter
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.optionalStudyLabel
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.QuietDisclosure
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.theme.layoutEnd
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
    val extraLabel = optionalStudyLabel(syllabus.hasNotice == true, syllabus.examDocument)

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val layout =
            when {
                maxWidth >= QUESTIONS_FROM -> RowLayout.WithQuestions
                maxWidth >= BAR_BESIDE_FROM -> RowLayout.BarBeside
                else -> RowLayout.Stacked
            }
        val barWidth = (maxWidth * BAR_SHARE).coerceIn(BAR_MIN, BAR_MAX)

        Column {
            if (exam) {
                // Main's legend for the bars (`bars-meaning`): quiet words, not a mono fact.
                SectionHeader(stringResource(R.string.goalcontent_subjects), Modifier.padding(horizontal = PAGE_PADDING)) {
                    Text(
                        stringResource(R.string.goalcontent_preparation),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                SharedExamsNote(syllabus.sharedExams, Modifier.padding(top = 8.dp))
            } else {
                SectionHeader(stringResource(R.string.goalcontent_modules), Modifier.padding(horizontal = PAGE_PADDING)) {
                    CoverageLegend()
                }
            }

            groups.forEach { group ->
                val name = if (group.extra) extraLabel else group.name
                if (name != null) SectionLabel(name, Modifier.padding(start = PAGE_PADDING, end = PAGE_PADDING, top = 16.dp, bottom = 4.dp))
                group.subjects.forEachIndexed { index, subject ->
                    if (index > 0) ListDivider()
                    SubjectRow(
                        subject = subject,
                        alsoIn = alsoInLine(syllabus.sharedExams, subject.sharedWith),
                        layout = layout,
                        barWidth = barWidth,
                        onClick = { onOpenSubject(subject.key) },
                    )
                }
            }

            SectionNote(annotate(sectionCount(syllabus)), Modifier.padding(top = 12.dp))
            // Main's quiet "Sources": where the question counts and the course's weights come from, for who wants to check.
            if (syllabus.questionsSource != null || syllabus.courseWeights?.source != null) {
                QuietDisclosure(stringResource(R.string.plan_sources), Modifier.padding(horizontal = PAGE_PADDING)) {
                    Column(Modifier.bleed(PAGE_PADDING).padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuestionsSourceNote(syllabus)
                        CourseWeightsNote(syllabus.subjects, syllabus.courseWeights)
                    }
                }
            }
        }
    }
}

private enum class RowLayout { Stacked, BarBeside, WithQuestions }

@Composable
private fun SubjectRow(
    subject: SyllabusSubject,
    alsoIn: String?,
    layout: RowLayout,
    barWidth: Dp,
    onClick: () -> Unit,
) {
    val notPlanned = subject.notPlannedReason != null
    val bar = if (notPlanned) null else subject.bar
    val share = bar?.share ?: subject.preparation
    val locale = currentLocale()
    val progressText = if (subject.isExtra) lessonsDoneText(subject) else share?.let { formatProgressShare(it, locale) }.orEmpty()
    // Optional study's count says its progress; a bar would sit under Preparation, which the exam doesn't measure for it.
    val showsBar = !notPlanned && !subject.isExtra
    val questions = subject.questions?.takeIf { it > 0 }?.toInt()

    val name: @Composable (Modifier) -> Unit = { nameModifier ->
        Column(nameModifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = subject.shortName,
                color = if (notPlanned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
            if (alsoIn != null) {
                Text(alsoIn, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
    val progress: @Composable (Modifier) -> Unit = { progressModifier ->
        if (bar != null) {
            CoverageBar(studied = bar.studied, known = bar.known, modifier = progressModifier)
        } else {
            Text(
                planOutsideReason(subject.notPlannedReason),
                progressModifier,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }

    ListRow(
        headline = {
            if (layout == RowLayout.Stacked) {
                name(Modifier)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    name(Modifier.weight(1f))
                    if (layout == RowLayout.WithQuestions) {
                        Text(
                            text = questions?.let { pluralStringResource(R.plurals.goalcontent_question_count, it, it) }.orEmpty(),
                            modifier = Modifier.width(QUESTIONS_WIDTH),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = factsStyle(),
                            textAlign = layoutEnd(),
                            maxLines = 1,
                        )
                    }
                    if (showsBar) progress(Modifier.width(barWidth))
                }
            }
        },
        onClick = onClick,
        supporting = if ((layout == RowLayout.Stacked && showsBar) || notPlanned) ({ progress(Modifier.padding(top = 8.dp)) }) else null,
        meta = {
            Text(
                text = progressText,
                modifier = Modifier.widthIn(min = SHARE_WIDTH),
                color = if (notPlanned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                style = factsStyle(),
                textAlign = layoutEnd(),
            )
        },
    )
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
            ).factsLine()
        }

        syllabus.goal.kind == GoalContentGoal.Kind.EXAM -> {
            val count = if (syllabus.kind == Syllabus.Kind.NOTICE) subjects else syllabus.subjects.count { !it.isExtra }
            pluralStringResource(R.plurals.goalcontent_subject_count, count, count)
        }

        else -> {
            pluralStringResource(R.plurals.goalcontent_module_count, syllabus.subjects.size, syllabus.subjects.size)
        }
    }
}

/** Optional study isn't on the exam, so its row counts the lessons done instead of a readiness share. */
@Composable
private fun lessonsDoneText(subject: SyllabusSubject): String {
    val locale = currentLocale()
    return stringResource(
        R.string.plan_done_of_total,
        formatNumber(subject.lessonsDone.toDouble(), locale),
        formatNumber(subject.lessonsTotal.toDouble(), locale),
    )
}

@Composable
private fun QuestionsSourceNote(
    syllabus: Syllabus,
    modifier: Modifier = Modifier,
) {
    val source = syllabus.questionsSource ?: return
    val publisher = sourceHost(source.url)
    val edition = source.edition
    val sentence =
        if (edition != null) {
            stringResource(R.string.goalcontent_questions_source_edition, edition, publisher)
        } else {
            stringResource(R.string.goalcontent_questions_source_latest, publisher)
        }

    SectionNote(annotate(sentence, publisher to LinkTarget(source.url)), modifier)
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

@Composable
internal fun planOutsideReason(reason: String?): String =
    stringResource(
        when (reason) {
            "skipped" -> R.string.plan_outside_skipped
            "known" -> R.string.plan_skipped_known
            "pastBasics" -> R.string.plan_outside_past_basics
            "skippedBase" -> R.string.plan_outside_skipped_base
            "missing" -> R.string.today_coming_not_written
            "time" -> R.string.plan_outside_time
            else -> R.string.plan_not_in_your_plan
        },
    )
