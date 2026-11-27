package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.ChapterRow
import com.zoonk.android.feature.plan.PhaseRow
import com.zoonk.android.feature.plan.isWritingAhead
import com.zoonk.android.feature.plan.optionalStudyLabel
import com.zoonk.android.feature.plan.sameWords
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowWordsStart
import com.zoonk.android.ui.theme.layoutEnd
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusSubject

/**
 * Main's `RevealStructure`: everything a new plan holds, in the groups the Plan shows it in: an exam's subjects with
 * their topics, or the path's phases with their chapters. Each group opens in place, and nothing here leaves the
 * screen: changing the plan is "Adjust plan". Draw it once [syllabus] has answered, so the list doesn't swap kinds.
 */
@Composable
fun RevealStructure(
    plan: Plan,
    syllabus: Syllabus?,
    modifier: Modifier = Modifier,
) {
    if (syllabus != null && syllabus.hasSubjectPages) {
        RevealSubjects(syllabus, modifier)
    } else {
        RevealPath(plan, modifier)
    }
}

/** A plan of one phase has nothing to group, so its chapters are the list. */
@Composable
private fun RevealPath(
    plan: Plan,
    modifier: Modifier,
) {
    val phases = plan.phases
    val only = phases.singleOrNull()
    if (phases.isEmpty()) return

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_your_path))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            if (only != null) {
                only.chapters.filterNot { it.isWritingAhead }.forEach { ChapterRow(it, links = null, indent = 0.dp) }
            } else {
                phases.forEachIndexed { index, phase ->
                    if (index > 0) ListDivider()
                    RevealPhase(plan, phase)
                }
            }
        }
    }
}

/** Every chapter of the phase, with no fold and no challenge: the Plan says when each comes. */
@Composable
private fun RevealPhase(
    plan: Plan,
    phase: PlanPhase,
) {
    val chapters = phase.chapters.filterNot { it.isWritingAhead }
    val line = phase.milestone?.let(::sameWords)
    if (chapters.isEmpty()) {
        PhaseRow(plan, phase, line)
        return
    }

    var expanded by rememberSaveable(phase.index) { mutableStateOf(false) }
    Column {
        PhaseRow(plan, phase, line, onClick = { expanded = !expanded }, expanded = expanded)
        if (expanded) {
            chapters.forEach { ChapterRow(it, links = null, indent = listRowWordsStart() - LIST_ITEM_INSET) }
        }
    }
}

@Composable
private fun RevealSubjects(
    syllabus: Syllabus,
    modifier: Modifier,
) {
    val groups = groupSubjects(syllabus.subjects, modules = syllabus.kind == Syllabus.Kind.MODULES)
    val exam = syllabus.isExam

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val withQuestions = maxWidth >= QUESTIONS_FROM
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader(stringResource(if (exam) R.string.goalcontent_subjects else R.string.goalcontent_modules))
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                groups.forEach { group ->
                    val name = if (group.extra) optionalStudyLabel(syllabus.hasNotice == true, syllabus.examDocument) else group.name
                    if (name != null) {
                        SectionLabel(name, Modifier.padding(start = LIST_ITEM_INSET, end = LIST_ITEM_INSET, top = 16.dp, bottom = 4.dp))
                    }
                    group.subjects.forEachIndexed { index, subject ->
                        if (index > 0) ListDivider()
                        RevealSubject(subject, withQuestions, module = !exam)
                    }
                }
            }
        }
    }
}

/** Opens in place to its topics by heading, each opening to its chapters, or straight to its chapters without topics. */
@Composable
private fun RevealSubject(
    subject: SyllabusSubject,
    withQuestions: Boolean,
    module: Boolean,
) {
    val notPlanned = subject.notPlannedReason != null
    val line =
        when {
            notPlanned -> {
                planOutsideReason(subject.notPlannedReason, module)
            }

            subject.topics.isNotEmpty() -> {
                pluralStringResource(R.plurals.goalcontent_topic_count, subject.topics.size, subject.topics.size)
            }

            subject.chapters.isNotEmpty() -> {
                pluralStringResource(
                    R.plurals.onboarding_course_chapters,
                    subject.chapters.size,
                    subject.chapters.size,
                )
            }

            else -> {
                null
            }
        }
    val questions = subject.questions?.toInt()?.takeIf { it > 0 && withQuestions }
    val opens = subject.topics.isNotEmpty() || subject.chapters.isNotEmpty()
    var expanded by rememberSaveable(subject.key) { mutableStateOf(false) }

    Column {
        ListRow(
            headline = {
                Text(
                    subject.shortName,
                    color = if (notPlanned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                )
            },
            onClick = if (opens) ({ expanded = !expanded }) else null,
            expanded = if (opens) expanded else null,
            supporting = line?.let { { Text(it) } },
            meta =
                questions?.let {
                    {
                        Text(
                            pluralStringResource(R.plurals.goalcontent_question_count, it, it),
                            style = factsStyle(),
                            textAlign = layoutEnd(),
                            maxLines = 1,
                        )
                    }
                },
            chevronSpace = true,
        )
        if (opens && expanded) SubjectContents(subject)
    }
}

@Composable
private fun SubjectContents(subject: SyllabusSubject) {
    Column(Modifier.padding(start = LIST_ITEM_INSET, end = LIST_ITEM_INSET, bottom = 8.dp)) {
        if (subject.topics.isEmpty()) {
            subject.chapters.forEach { TopicChapterLink(it, actions = null) }
            return@Column
        }

        val showFrequency = setsApart(subject.topics.map { it.frequency })
        val digits =
            subject.topics.size
                .toString()
                .length
        splitByHeading(subject.topics).forEach { run ->
            if (run.heading != null) SectionLabel(run.heading, Modifier.padding(top = 12.dp, bottom = 4.dp))
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                groupTopics(run.topics) { it.name }.forEachIndexed { index, group ->
                    if (index > 0) ListDivider()
                    TopicGroupRow(group, showFrequency, actions = null, countDigits = digits)
                }
            }
        }
    }
}

/** Main's container width for the question count beside a subject's name: 32rem. */
private val QUESTIONS_FROM = 512.dp
