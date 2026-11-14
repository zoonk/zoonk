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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.ProgressMark
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowWordsStart
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanCourse
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
    brief: Boolean = false,
    course: PlanCourse? = null,
) {
    val phases = page.plan.phases
    val roadmap = page.plan.roadmapPhases
    val openIndex = findOpenPhase(phases)
    val beforeFinish = phases.filter { it.kind != PlanPhase.Kind.AFTER_EXAM }
    val afterExam = phases.filter { it.kind == PlanPhase.Kind.AFTER_EXAM }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_your_path))

        alphabet?.invoke()

        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            beforeFinish.forEachIndexed { position, phase ->
                if (position > 0) HorizontalDivider()
                PhaseItem(page, phase, phase.index == openIndex, links, brief)
            }
            HorizontalDivider()
            FinishItem(page, links)
            afterExam.forEach { phase ->
                HorizontalDivider()
                PhaseItem(page, phase, open = phase.index == openIndex, links = links, brief = brief)
            }
            course?.let {
                HorizontalDivider()
                ListRow(
                    headline = { Text(stringResource(R.string.plan_full_course)) },
                    onClick = { links.course(it.courseId.toString()) },
                    leading = { Icon(painterResource(R.drawable.ic_local_library), contentDescription = null) },
                )
            }
        }
    }
}

@Composable
private fun PhaseItem(
    page: PlanPageState,
    phase: PlanPhase,
    open: Boolean,
    links: PlanLinks,
    brief: Boolean,
) {
    val name = phaseName(phase, page.mocksRequirePlus)
    val own = phase.ownChapter(name)
    val nested = listRowWordsStart() - LIST_ITEM_INSET

    if (own != null) {
        val chapterId = own.chapterId.toString()
        val isNext = own.state == PlanPhaseChaptersInner.State.CURRENT
        Column {
            PhaseRow(
                page,
                phase,
                open,
                onClick = { links.chapter(chapterId) },
                highlighted = isNext,
                nextChapter = own.takeIf { isNext },
            )
            if (open) {
                phase.checkpoint?.let { CheckpointRow(page, it, links, indent = nested, brief = brief) }
            }
        }
        return
    }

    val hasContent = phase.chapters.isNotEmpty() || phase.checkpoint != null
    if (!hasContent) {
        PhaseRow(page, phase, open)
        return
    }

    // Keyed by whether it's the open phase, so one opened or shut by hand keeps it until the plan moves on.
    var expanded by rememberSaveable(phase.index, open) { mutableStateOf(open) }
    val byPlace = phase.isNamedLikeAChapter(name)

    Column {
        PhaseRow(page, phase, open, onClick = { expanded = !expanded }, expanded = expanded, byPlace = byPlace && expanded)
        if (expanded) PhaseChapters(page, phase.chapters, phase.checkpoint, links, indent = nested, brief = brief)
    }
}

@Composable
private fun PhaseRow(
    page: PlanPageState,
    phase: PlanPhase,
    open: Boolean,
    onClick: (() -> Unit)? = null,
    highlighted: Boolean = false,
    expanded: Boolean? = null,
    byPlace: Boolean = false,
    nextChapter: PlanPhaseChaptersInner? = null,
) {
    val date = phaseEnd(page, phase)
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
        supporting = line?.let { { Text(it.text, Modifier.semantics { contentDescription = it.spoken }) } },
        meta = date?.let { { TrailingText(it) } },
    )
}

/**
 * Main's `usePhaseEnd`: when a phase ends, the same on its path row and on the line under the
 * roadmap: a short plan's days, its last day, or the plan's estimate ("~Nov 10", "~Jan"), which a
 * learning phase's end is while it's ahead or its challenge, with no booked day, is still to come.
 * The last phase before the finish shows nothing when the finish row shows that day; an exam with
 * no date yet shows the plan's estimated end there instead.
 */
@Composable
internal fun phaseEnd(
    page: PlanPageState,
    phase: PlanPhase,
): PlanDateWords? {
    shortDays(page.plan, phase)?.let { return sameWords(it) }
    if (phase.state == PlanPhase.State.DONE || phase.state == PlanPhase.State.UNFINISHED ||
        phase.state == PlanPhase.State.LEFT_OUT
    ) {
        return null
    }
    val plan = page.plan
    if (phase.index == plan.phases.lastOrNull { it.kind != PlanPhase.Kind.AFTER_EXAM }?.index) {
        val end = plan.estimate.endDate?.toJavaLocalDate()
        if (plan.schedule.targetDate != null || !page.isExam || end == null) return null
        val month = plan.estimateNamesMonth(end)
        return endWords(formatPlanDate(end, page.today, currentLocale(), month = month), estimate = true, month = month)
    }
    val end = phase.lastDay() ?: return null
    val learns = phase.kind == PlanPhase.Kind.LEARN || phase.kind == PlanPhase.Kind.AFTER_EXAM
    val ahead = phase.state == PlanPhase.State.UPCOMING
    val estimate = learns && (ahead || phase.checkpoint?.state == PlanPhaseCheckpoint.State.UPCOMING)
    val month = estimate && ahead && plan.estimateNamesMonth(end)
    return endWords(formatPlanDate(end, page.today, currentLocale(), month = month), estimate, month)
}

/** A phase is behind the learner on its challenge's day, which can come after its last lesson. */
private fun PlanPhase.lastDay(): LocalDate? {
    val challengeDay = checkpoint?.takeIf { it.state == PlanPhaseCheckpoint.State.UPCOMING }?.date?.toJavaLocalDate()
    return if (challengeDay != null && end != null && challengeDay.isAfter(end)) challengeDay else end
}

/** A phase's or the goal's end as it's shown ("Nov 10", "~Nov 10") and as TalkBack says it ("Ends about Nov 10"). */
@Composable
internal fun endWords(
    date: String,
    estimate: Boolean,
    month: Boolean,
): PlanDateWords =
    when {
        !estimate -> {
            PlanDateWords(date, stringResource(R.string.plan_ends, date), date = true)
        }

        month -> {
            PlanDateWords(
                stringResource(R.string.plan_date_estimate, date),
                stringResource(R.string.plan_ends_about_month, date),
                date = true,
            )
        }

        else -> {
            PlanDateWords(stringResource(R.string.plan_date_estimate, date), stringResource(R.string.plan_ends_about, date), date = true)
        }
    }

@Composable
private fun phaseMeta(
    page: PlanPageState,
    phase: PlanPhase,
    open: Boolean,
): PlanDateWords? {
    if (phase.state == PlanPhase.State.LEFT_OUT) return sameWords(stringResource(R.string.plan_not_in_your_plan))
    if (phase.state == PlanPhase.State.UNFINISHED) {
        val leftOut = (phase.lessonsTotal - phase.lessonsDone).toInt()
        return sameWords(
            if (leftOut > 0) {
                pluralStringResource(R.plurals.plan_lessons_not_studied, leftOut, leftOut)
            } else {
                challengeNotInPlan(page)
            },
        )
    }
    if (phase.challengeLeftOut) return sameWords(challengeNotInPlan(page))
    if (phase.state != PlanPhase.State.CURRENT || open) return null

    if (phase.lessonsDone < phase.lessonsTotal) {
        val resumes =
            phase.chapters
                .filter { it.state != PlanPhaseChaptersInner.State.DONE }
                .mapNotNull { it.nextDate?.toJavaLocalDate() }
                .minOrNull() ?: return null
        return sameWords(
            if (resumes == LocalDate.now()) {
                stringResource(R.string.plan_continues_today)
            } else {
                stringResource(R.string.plan_continues_on, formatPlanDate(resumes, page.today, currentLocale()))
            },
        )
    }
    return null
}

private fun sameWords(text: String) = PlanDateWords(text, text)

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
    indent: Dp = 0.dp,
    brief: Boolean = false,
) {
    var showAll by rememberSaveable { mutableStateOf(false) }
    val rows = chapters.filterNot { it.isWritingAhead }
    val window = chapterWindow(rows.map { it.state })
    val hidden = rows.size - (window.last - window.first + 1).coerceAtLeast(0)
    val shown = if (showAll) rows else rows.slice(window)

    Column {
        shown.forEach { ChapterRow(it, links, indent) }
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
                indent = indent,
                leading = { Icon(painterResource(if (showAll) R.drawable.ic_remove else R.drawable.ic_add), contentDescription = null) },
                chevron = false,
            )
        }
        checkpoint?.let { CheckpointRow(page, it, links, indent, brief) }
    }
}

@Composable
private fun ChapterRow(
    chapter: PlanPhaseChaptersInner,
    links: PlanLinks,
    indent: Dp,
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
        indent = indent,
        leading = { ChapterMark(chapter, isNext) },
        supporting = line?.let { { Text(it) } },
    )
}

/** A phase's challenge by its one name: the Trickster, or a language plan's call. */
@Composable
internal fun challengeName(page: PlanPageState): String =
    stringResource(if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) R.string.session_block_call else R.string.checkpoint_trickster)

@Composable
private fun challengeNotInPlan(page: PlanPageState): String =
    stringResource(
        if (page.goal.kind ==
            LearnerSummaryGoal.Kind.LANGUAGE
        ) {
            R.string.plan_call_not_in_plan
        } else {
            R.string.plan_trickster_not_in_plan
        },
    )

/** [brief] leaves out what a challenge is in a list of every phase's, where it would repeat. */
@Composable
internal fun CheckpointRow(
    page: PlanPageState,
    checkpoint: PlanPhaseCheckpoint,
    links: PlanLinks,
    indent: Dp = 0.dp,
    brief: Boolean = false,
) {
    val done = checkpoint.state == PlanPhaseCheckpoint.State.DONE
    // A locked one is never in a session, so it keeps its planned day.
    val whenPlanned = if (checkpoint.locked) PlanPhaseCheckpoint.`When`.DATE else checkpoint.`when`
    val date = checkpoint.date?.toJavaLocalDate()
    val trailing =
        when {
            done -> sameWords(stringResource(R.string.plan_challenge_won))

            // Dated today, the next session is today's, which may already be under way.
            whenPlanned == PlanPhaseCheckpoint.`When`.NEXT_SESSION && date == page.today -> sameWords(stringResource(R.string.plan_today))

            whenPlanned == PlanPhaseCheckpoint.`When`.NEXT_SESSION -> sameWords(stringResource(R.string.plan_challenge_next_session))

            date != null -> planDate(date, page.today, estimate = true)

            else -> null
        }
    val planItemId = checkpoint.planItemId?.toString()
    val lines =
        listOfNotNull(
            if (brief || done) {
                null
            } else {
                stringResource(
                    if (page.goal.kind ==
                        LearnerSummaryGoal.Kind.LANGUAGE
                    ) {
                        R.string.plan_challenge_live_call
                    } else {
                        R.string.plan_challenge_questions
                    },
                )
            },
            if (planItemId == null && !done) stringResource(R.string.plan_challenge_opens_after_lessons) else null,
        )

    ListRow(
        headline = {
            Text(
                text = challengeName(page),
                color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
        },
        onClick = planItemId?.let { { links.challenge(it) } },
        indent = indent,
        leading = { Trickster(Modifier.size(markSize())) },
        supporting = if (lines.isEmpty()) null else ({ Column { lines.forEach { Text(it) } } }),
        meta =
            trailing?.let { { TrailingText(it) } },
    )
}

@Composable
internal fun MockRow(
    page: PlanPageState,
    date: LocalDate,
    links: PlanLinks,
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
    val minutes = funded?.minutes?.takeIf { it > 0 }

    ListRow(
        headline = { Text(stringResource(R.string.plan_mock_exam)) },
        onClick = onClick,
        leading = { KindMark(LearnKind.Mock) },
        supporting = minutes?.let { { Text(formatMinutes(it.roundToInt(), locale)) } },
        meta = { TrailingText(planDate(date, page.today)) },
    )
}

@Composable
private fun FinishItem(
    page: PlanPageState,
    links: PlanLinks,
) {
    val finish =
        page.finish?.let { planDate(it.date, page.today, it.estimate, it.month) }
            ?: if (page.isExam) sameWords(stringResource(R.string.plan_date_to_be_confirmed)) else null

    ListRow(
        headline = { Text(page.goal.displayName) },
        onClick = if (links.hasExam) links::exam else null,
        leading = { FlagMark() },
        supporting = if (links.hasExam) ({ Text(stringResource(R.string.plan_about_exam)) }) else null,
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

/** Main's `ListRowTrailing` on every Plan row and line: a date is data in mono, words keep the text face. */
@Composable
internal fun TrailingText(words: PlanDateWords) {
    Text(
        text = words.text,
        modifier = Modifier.semantics { contentDescription = words.spoken },
        style = if (words.date) MaterialTheme.zoonkType.data else MaterialTheme.typography.bodySmall,
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
            text = listOfNotNull(range, lessons).factsLine(),
            style = MaterialTheme.zoonkType.data,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        if (learn) {
            PhaseChapters(page, phase.chapters, phase.checkpoint, links)
        } else {
            phase.mocks.nextDate?.let { MockRow(page, it.toJavaLocalDate(), links) }
            if (phase.mocks.nextDate == null && phase.mocks.count > 0) {
                Row(
                    modifier = Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MetaLine(pluralStringResource(R.plurals.plan_mock_exams_count, phase.mocks.count.toInt(), phase.mocks.count.toInt()))
                }
            }
            phase.checkpoint?.let { CheckpointRow(page, it, links) }
        }
    }
}
