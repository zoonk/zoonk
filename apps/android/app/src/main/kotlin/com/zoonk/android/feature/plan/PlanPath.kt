package com.zoonk.android.feature.plan

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.ProgressMark
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowWordsStart
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPhaseCheckpoint
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.math.roundToInt

@Composable
internal fun PathSection(
    page: PlanPageState,
    links: PlanLinks,
    modifier: Modifier = Modifier,
    alphabet: (@Composable () -> Unit)? = null,
) {
    val phases = page.plan.phases
    val roadmap = page.plan.roadmapPhases
    val openIndex = findOpenPhase(phases)
    val beforeFinish = phases.filter { it.kind != PlanPhase.Kind.AFTER_EXAM }
    val afterExam = phases.filter { it.kind == PlanPhase.Kind.AFTER_EXAM }
    val lastIndex = beforeFinish.lastOrNull()?.index

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader(stringResource(R.string.plan_your_path), Modifier.weight(1f))
            if (roadmap.size >= 2) {
                val done = roadmap.count { it.state == PlanPhase.State.DONE }
                Text(
                    text = pluralStringResource(R.plurals.plan_phases_done, roadmap.size, done, roadmap.size),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        alphabet?.invoke()

        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            beforeFinish.forEachIndexed { position, phase ->
                if (position > 0) HorizontalDivider()
                PhaseItem(page, phase, phase.index == lastIndex, phase.index == openIndex, links)
            }
            HorizontalDivider()
            FinishItem(page)
            afterExam.forEach { phase ->
                HorizontalDivider()
                PhaseItem(page, phase, isLast = false, open = phase.index == openIndex, links = links)
            }
        }
    }
}

@Composable
private fun PhaseItem(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    open: Boolean,
    links: PlanLinks,
) {
    val name = phaseName(phase, page.mocksRequirePlus)
    val own = phase.ownChapter(name)
    val nested = Modifier.padding(start = listRowWordsStart() - LIST_ITEM_INSET)

    if (own != null) {
        val chapterId = own.chapterId.toString()
        val isNext = own.state == PlanPhaseChaptersInner.State.CURRENT
        Column {
            PhaseRow(
                page,
                phase,
                isLast,
                open,
                onClick = { links.chapter(chapterId) },
                highlighted = isNext,
                nextChapter = own.takeIf { isNext },
            )
            if (open) {
                Column(nested) {
                    phase.checkpoint?.let { CheckpointRow(page, it, links) }
                    WritingAheadLine(phase.chapters, unit = page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE)
                }
            }
        }
        return
    }

    val hasContent = phase.chapters.isNotEmpty() || phase.checkpoint != null
    if (!hasContent) {
        PhaseRow(page, phase, isLast, open)
        return
    }

    // Keyed by whether it's the open phase, so one opened or shut by hand keeps it until the plan moves on.
    var expanded by rememberSaveable(phase.index, open) { mutableStateOf(open) }
    val byPlace = phase.isNamedLikeAChapter(name)

    Column {
        PhaseRow(page, phase, isLast, open, onClick = { expanded = !expanded }, expanded = expanded, byPlace = byPlace && expanded)
        if (expanded) {
            Column(nested) {
                PhaseChapters(page, phase.chapters, phase.checkpoint, links)
            }
        }
    }
}

@Composable
private fun PhaseRow(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    open: Boolean,
    onClick: (() -> Unit)? = null,
    highlighted: Boolean = false,
    expanded: Boolean? = null,
    byPlace: Boolean = false,
    nextChapter: PlanPhaseChaptersInner? = null,
) {
    val until = phaseUntil(page, phase, isLast)
    val name = phaseName(phase, page.mocksRequirePlus, byPlace = byPlace)
    val state =
        if (nextChapter != null && phase.state != PlanPhase.State.CURRENT) {
            stringResource(R.string.plan_up_next_suffix)
        } else {
            phaseStateWords(phase.state)
        }
    val line = phaseMeta(page, phase, open)
    val color = if (phase.state == PlanPhase.State.DONE) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface

    ListRow(
        headline = {
            Text(
                text = name,
                modifier = Modifier.semantics { contentDescription = name + state },
                color = color,
            )
        },
        onClick = onClick,
        highlighted = highlighted,
        expanded = expanded,
        leading = { if (nextChapter != null) ChapterMark(nextChapter, isNext = true) else PhaseMark(phase) },
        supporting = line?.let { { Text(it) } },
        meta =
            if (phase.lessonsTotal > 0 || until != null) {
                {
                    if (phase.lessonsTotal > 0) LessonsCount(phase.lessonsDone, phase.lessonsTotal)
                    until?.let { TrailingText(it) }
                }
            } else {
                null
            },
    )
}

@Composable
private fun LessonsCount(
    done: Long,
    total: Long,
) {
    val spoken = lessonsDoneSpoken(done, total)
    TrailingText(
        PlanDateWords(stringResource(R.string.plan_lessons_count, done.toInt(), total.toInt()), spoken),
    )
}

@Composable
private fun phaseUntil(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
): PlanDateWords? {
    shortDays(page.plan, phase)?.let { return PlanDateWords(it, it) }
    val end = phase.end ?: return null
    if (phase.state == PlanPhase.State.DONE || phase.state == PlanPhase.State.UNFINISHED ||
        phase.state == PlanPhase.State.LEFT_OUT
    ) {
        return null
    }
    if (isLast && phase.kind != PlanPhase.Kind.AFTER_EXAM && page.finish != null) return null
    val estimate =
        (phase.kind == PlanPhase.Kind.LEARN || phase.kind == PlanPhase.Kind.AFTER_EXAM) && phase.state == PlanPhase.State.UPCOMING
    val date = formatPlanDate(end, page.today, currentLocale(), month = estimate)
    return if (estimate) {
        PlanDateWords(stringResource(R.string.plan_until_estimate, date), stringResource(R.string.plan_until_estimate_spoken, date))
    } else {
        stringResource(R.string.plan_until, date).let { PlanDateWords(it, it) }
    }
}

@Composable
private fun phaseMeta(
    page: PlanPageState,
    phase: PlanPhase,
    open: Boolean,
): String? {
    if (phase.state == PlanPhase.State.LEFT_OUT) return stringResource(R.string.plan_not_in_your_plan)
    if (phase.state == PlanPhase.State.UNFINISHED) {
        val leftOut = (phase.lessonsTotal - phase.lessonsDone).toInt()
        return if (leftOut > 0) {
            pluralStringResource(R.plurals.plan_lessons_left_out, leftOut, leftOut)
        } else {
            stringResource(R.string.plan_challenge_left_out)
        }
    }
    if (phase.state != PlanPhase.State.CURRENT || open) return null

    val writing = phase.chapters.any { it.writing }
    val lessonsLeft = phase.lessonsDone < phase.lessonsTotal
    if (!writing && lessonsLeft) {
        val resumes =
            phase.chapters
                .filter { it.state != PlanPhaseChaptersInner.State.DONE }
                .mapNotNull { it.nextDate?.toJavaLocalDate() }
                .minOrNull() ?: return null
        return if (resumes == LocalDate.now()) {
            stringResource(R.string.plan_continues_today)
        } else {
            stringResource(R.string.plan_continues_on, formatPlanDate(resumes, page.today, currentLocale()))
        }
    }
    val checkpoint = phase.checkpoint
    val challengeDate =
        checkpoint
            ?.takeIf { it.state == PlanPhaseCheckpoint.State.UPCOMING && it.`when` == PlanPhaseCheckpoint.`When`.DATE }
            ?.date
            ?.let { formatPlanDate(it.toJavaLocalDate(), page.today, currentLocale()) }
    return when {
        writing && challengeDate != null -> stringResource(R.string.plan_more_lessons_challenge_on, challengeDate)
        writing -> stringResource(R.string.plan_more_lessons_on_the_way)
        challengeDate != null -> stringResource(R.string.plan_lessons_done_challenge_on, challengeDate)
        else -> null
    }
}

@Composable
private fun PhaseMark(phase: PlanPhase) {
    when (phase.state) {
        PlanPhase.State.DONE -> StatusMark(MarkStatus.Done)
        PlanPhase.State.CURRENT -> CurrentPhaseMark()
        else -> StatusMark(MarkStatus.Todo)
    }
}

/** The current phase: an ink dot with a halo, where the learner's next chapter is a blue one. */
@Composable
private fun CurrentPhaseMark() {
    val ink = MaterialTheme.colorScheme.onSurface
    Canvas(Modifier.size(markSize())) {
        drawCircle(ink.copy(alpha = HALO_ALPHA), radius = size.minDimension * HALO_SHARE)
        drawCircle(ink, radius = size.minDimension * DOT_SHARE)
    }
}

private const val HALO_ALPHA = 0.15f
private const val HALO_SHARE = 0.4f
private const val DOT_SHARE = 0.22f

@Composable
internal fun ChapterMark(
    chapter: PlanPhaseChaptersInner,
    isNext: Boolean,
) {
    ChapterMark(
        isNext = isNext,
        done = chapter.state == PlanPhaseChaptersInner.State.DONE,
        skipped = chapter.isSkipped,
        writing = chapter.writing,
        lessonsDone = chapter.lessonsDone,
        lessonsTotal = chapter.lessonsTotal,
    )
}

/** A chapter's mark wherever it's listed: next, part done as a ring, skipped, done or ahead. */
@Composable
internal fun ChapterMark(
    isNext: Boolean,
    done: Boolean,
    skipped: Boolean,
    writing: Boolean,
    lessonsDone: Long,
    lessonsTotal: Long,
) {
    when {
        isNext -> {
            StatusMark(MarkStatus.Next, contentDescription = stringResource(R.string.plan_up_next))
        }

        !done && !writing && lessonsDone > 0 && lessonsTotal > 0 -> {
            ProgressMark(lessonsDone.toFloat() / lessonsTotal, contentDescription = lessonsDoneSpoken(lessonsDone, lessonsTotal))
        }

        done && skipped -> {
            StatusMark(MarkStatus.Skipped, contentDescription = stringResource(R.string.plan_skipped))
        }

        done -> {
            StatusMark(MarkStatus.Done, contentDescription = stringResource(R.string.plan_done))
        }

        else -> {
            StatusMark(MarkStatus.Todo)
        }
    }
}

@Composable
internal fun PhaseChapters(
    page: PlanPageState,
    chapters: List<PlanPhaseChaptersInner>,
    checkpoint: PlanPhaseCheckpoint?,
    links: PlanLinks,
) {
    var showAll by rememberSaveable { mutableStateOf(false) }
    val rows = chapters.filterNot { it.isWritingAhead }
    val window = chapterWindow(rows.map { it.state })
    val hidden = rows.size - (window.last - window.first + 1).coerceAtLeast(0)
    val shown = if (showAll) rows else rows.slice(window)

    Column {
        shown.forEach { ChapterRow(it, links) }
        if (hidden > 0) {
            ListRow(
                headline = {
                    Text(
                        text =
                            if (showAll) {
                                stringResource(R.string.plan_show_fewer_chapters)
                            } else {
                                pluralStringResource(R.plurals.plan_more_chapters, hidden, hidden)
                            },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                onClick = { showAll = !showAll },
                leading = { Icon(painterResource(if (showAll) R.drawable.ic_remove else R.drawable.ic_add), contentDescription = null) },
            )
        }
        checkpoint?.let { CheckpointRow(page, it, links) }
        WritingAheadLine(chapters)
    }
}

@Composable
private fun ChapterRow(
    chapter: PlanPhaseChaptersInner,
    links: PlanLinks,
) {
    val isNext = chapter.state == PlanPhaseChaptersInner.State.CURRENT
    val chapterId = chapter.chapterId?.toString()
    val skillId = chapter.skillId
    val title = chapterTitle(chapter)
    val opensChapter = !(chapter.writing && skillId != null) && chapterId != null
    val line = chapterLine(chapter)

    ListRow(
        headline = {
            Text(
                text = title,
                color =
                    if (chapter.state == PlanPhaseChaptersInner.State.DONE) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        },
        onClick =
            when {
                chapter.writing && skillId != null -> links.farTopic(FarTopic(skillId, title, chapter.plannedLessons, chapter.nextDate))
                chapterId != null -> ({ links.chapter(chapterId) })
                else -> null
            },
        highlighted = isNext && opensChapter,
        leading = { ChapterMark(chapter, isNext) },
        supporting = line?.let { { Text(it) } },
        meta =
            if (!chapter.writing && chapter.lessonsTotal > 0 && !chapter.isSkipped) {
                { LessonsCount(chapter.lessonsDone, chapter.lessonsTotal) }
            } else {
                null
            },
    )
}

/** Lessons on the way inside the next two weeks: one line for the phase, not a row each. */
@Composable
internal fun WritingAheadLine(
    chapters: List<PlanPhaseChaptersInner>,
    unit: Boolean = false,
) {
    val writing = chapters.filter { it.isWritingAhead }
    if (writing.isEmpty()) return
    val courses = writing.map { it.title }.filter { it.isNotEmpty() }
    val text =
        when {
            courses.isNotEmpty() -> stringResource(R.string.plan_lessons_being_written_from, courses.joinToString(", "))
            unit -> stringResource(R.string.plan_unit_lessons_being_written)
            else -> stringResource(R.string.plan_phase_lessons_being_written)
        }
    Text(
        text = text,
        modifier = Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
internal fun CheckpointRow(
    page: PlanPageState,
    checkpoint: PlanPhaseCheckpoint,
    links: PlanLinks,
) {
    val done = checkpoint.state == PlanPhaseCheckpoint.State.DONE
    // A locked one is never in a session, so it keeps its planned day.
    val whenPlanned = if (checkpoint.locked) PlanPhaseCheckpoint.`When`.DATE else checkpoint.`when`
    val date = checkpoint.date?.toJavaLocalDate()
    val trailing =
        when {
            done -> stringResource(R.string.plan_challenge_won)
            whenPlanned == PlanPhaseCheckpoint.`When`.NEXT_SESSION -> stringResource(R.string.plan_challenge_next_session)
            whenPlanned == PlanPhaseCheckpoint.`When`.QUEUED -> stringResource(R.string.plan_challenge_after_previous)
            date != null -> formatPlanDate(date, page.today, currentLocale())
            else -> null
        }
    val planItemId = checkpoint.planItemId?.toString()

    ListRow(
        headline = {
            Text(
                text = stringResource(R.string.plan_phase_challenge),
                color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
        },
        onClick = planItemId?.let { { links.challenge(it) } },
        leading = { Trickster(Modifier.size(markSize())) },
        meta =
            if (checkpoint.locked || trailing != null) {
                {
                    if (checkpoint.locked) PlusMark()
                    trailing?.let { TrailingText(PlanDateWords(it, it)) }
                }
            } else {
                null
            },
    )
}

@Composable
internal fun MockRow(
    page: PlanPageState,
    date: LocalDate,
    links: PlanLinks,
    forNextSitting: Boolean = false,
) {
    val funded = page.plan.fundedMocks.firstOrNull { it.scheduledFor?.toJavaLocalDate() == date }
    val onClick: (() -> Unit)? =
        when {
            funded != null -> {
                { links.challenge(funded.id.toString()) }
            }

            links.hasExam -> {
                links::exam
            }

            else -> {
                null
            }
        }
    val locale = currentLocale()
    val words = formatPlanDate(date, page.today, locale)
    val minutes = funded?.minutes?.takeIf { it > 0 }

    ListRow(
        headline = { Text(stringResource(if (forNextSitting) R.string.plan_mock_next_sitting else R.string.plan_mock_exam)) },
        onClick = onClick,
        leading = { KindMark(LearnKind.Mock) },
        supporting = minutes?.let { { Text(formatMinutes(it.roundToInt(), locale)) } },
        meta = {
            if (page.mocksRequirePlus) PlusMark()
            TrailingText(PlanDateWords(words, words))
        },
    )
}

@Composable
private fun FinishItem(page: PlanPageState) {
    val finish = page.finish?.let { planDate(it.date, page.today, it.estimate, it.month) }

    ListRow(
        headline = { Text(page.goal.title) },
        leading = { FlagMark() },
        meta = finish?.let { { TrailingText(it) } },
    )
}

@Composable
internal fun FlagMark() {
    Icon(painterResource(R.drawable.ic_flag), contentDescription = null)
}

internal val SHEET_MARGIN = 24.dp

@Composable
internal fun MetaLine(text: String) {
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
internal fun TrailingText(words: PlanDateWords) {
    Text(
        text = words.text,
        modifier = Modifier.semantics { contentDescription = words.spoken },
        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PhaseDetailsSheet(
    page: PlanPageState,
    phase: PlanPhase,
    links: PlanLinks,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PhaseDetails(page, phase, links)
        }
    }
}

@Composable
internal fun ColumnScope.PhaseDetails(
    page: PlanPageState,
    phase: PlanPhase,
    links: PlanLinks,
) {
    val learn = phase.kind == PlanPhase.Kind.LEARN
    val name = phaseName(phase, page.mocksRequirePlus)
    val byPlace = learn && phase.isNamedLikeAChapter(name)
    val range =
        phase.start?.let { start ->
            phase.end?.let { end ->
                val month = learn && phase.state == PlanPhase.State.UPCOMING
                stringResource(
                    R.string.plan_date_range,
                    formatPlanDate(start, page.today, currentLocale(), month),
                    formatPlanDate(end, page.today, currentLocale(), month),
                )
            }
        }
    val lessons =
        when (phase.state) {
            PlanPhase.State.LEFT_OUT -> {
                stringResource(R.string.plan_not_in_your_plan)
            }

            PlanPhase.State.DONE -> {
                stringResource(R.string.plan_done)
            }

            else -> {
                pluralStringResource(
                    R.plurals.plan_lessons_of,
                    phase.lessonsTotal.toInt(),
                    phase.lessonsDone.toInt(),
                    phase.lessonsTotal.toInt(),
                )
            }
        }

    Column {
        Text(
            text = phaseName(phase, page.mocksRequirePlus, byPlace),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        Text(
            text = listOfNotNull(range, lessons).joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    if (learn) {
        PhaseChapters(page, phase.chapters, phase.checkpoint, links)
    } else {
        Column {
            phase.mocks.nextDate?.let { MockRow(page, it.toJavaLocalDate(), links) }
            if (phase.mocks.nextDate == null && phase.mocks.count > 0) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetaLine(pluralStringResource(R.plurals.plan_mock_exams_count, phase.mocks.count.toInt(), phase.mocks.count.toInt()))
                    if (page.mocksRequirePlus) PlusMark()
                }
            }
            phase.checkpoint?.let { CheckpointRow(page, it, links) }
        }
    }
}
