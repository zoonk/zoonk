package com.zoonk.android.feature.plan

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.planOutsideReason
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkIcon
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.ProgressMark
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.glyphScale
import com.zoonk.android.ui.components.listRowDescription
import com.zoonk.android.ui.components.listRowWordsStart
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanCourse
import com.zoonk.api.models.PlanFundedMocksInner
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPhaseCheckpoint
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.UUID
import kotlin.math.roundToInt

@Composable
internal fun PathSection(
    page: PlanPageState,
    links: PlanLinks,
    modifier: Modifier = Modifier,
    alphabet: (@Composable () -> Unit)? = null,
    brief: Boolean = false,
    course: PlanCourse? = null,
    test: (@Composable () -> Unit)? = null,
) {
    val phases = page.plan.phases
    val roadmap = page.plan.roadmapPhases
    val openIndex = findOpenPhase(phases)
    val beforeFinish = phases.filter { it.kind != PlanPhase.Kind.AFTER_EXAM }
    val afterExam = phases.filter { it.kind == PlanPhase.Kind.AFTER_EXAM }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_your_path))

        alphabet?.invoke()
        test?.invoke()

        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            beforeFinish.forEachIndexed { position, phase ->
                if (position > 0) ListDivider()
                PhaseItem(page, phase, phase.index == openIndex, links, brief)
            }
            if (beforeFinish.isNotEmpty()) ListDivider()
            FinishItem(page, links, brief)
            afterExam.forEach { phase ->
                ListDivider()
                PhaseItem(page, phase, open = phase.index == openIndex, links = links, brief = brief)
            }
            course?.let {
                ListDivider()
                ListRow(
                    headline = { Text(stringResource(R.string.plan_full_course)) },
                    onClick = { links.course(it.courseId.toString()) },
                    leading = { MarkIcon(R.drawable.ic_library) },
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
                page.plan,
                phase,
                // The left-out row under it says what this phase's line would.
                phaseMeta(page, phase.copy(leftOut = emptyList()), open),
                paused = page.isPaused,
                onClick = { links.chapter(chapterId) },
                highlighted = isNext,
                nextChapter = own.takeIf { isNext },
            )
            LeftOutTopicsRow(phase.leftOut, indent = nested)
            if (open) {
                phase.mocks.nextDate?.let { MockRow(page, it.toJavaLocalDate(), links, phase.mocks.nextPlanItemId) }
                phase.checkpoint?.let { CheckpointRow(page, phase, it, links, indent = nested, brief = brief) }
            }
        }
        return
    }

    val hasContent =
        phase.chapters.isNotEmpty() || phase.leftOut.isNotEmpty() || phase.checkpoint != null || phase.mocks.nextDate != null
    if (!hasContent) {
        PhaseRow(page.plan, phase, phaseMeta(page, phase, open), paused = page.isPaused)
        return
    }

    // Keyed by whether it's the open phase, so one opened or shut by hand keeps it until the plan moves on.
    var expanded by rememberSaveable(phase.index, open) { mutableStateOf(open) }
    val byPlace = phase.isNamedLikeAChapter(name)

    Column {
        PhaseRow(
            page.plan,
            phase,
            phaseMeta(page, phase, open),
            paused = page.isPaused,
            onClick = { expanded = !expanded },
            expanded = expanded,
            leftOutTopics = leftOutLine(phase),
            // The current phase keeps its name open, as main's does.
            byPlace = byPlace && expanded && phase.state != PlanPhase.State.CURRENT,
        )
        if (expanded) {
            PhaseChapters(page, phase, links, indent = nested, brief = brief)
            phase.mocks.nextDate?.let { MockRow(page, it.toJavaLocalDate(), links, phase.mocks.nextPlanItemId) }
        }
    }
}

/** A phase's row on the path: its mark, what the learner can do by its end (else its name) over [line], and when it ends. */
@Composable
internal fun PhaseRow(
    plan: Plan,
    phase: PlanPhase,
    line: PlanDateWords?,
    onClick: (() -> Unit)? = null,
    highlighted: Boolean = false,
    expanded: Boolean? = null,
    byPlace: Boolean = false,
    nextChapter: PlanPhaseChaptersInner? = null,
    paused: Boolean = false,
    leftOutTopics: Int = 0,
) {
    // A paused plan's phases end when the learner resumes, so no date says otherwise, as main's `usePhaseEnd`.
    val date = if (paused) null else phaseEnd(plan, phase, plan.today)
    val name = phaseRowName(phase, plan.access.mocksRequirePlus, byPlace)
    val state =
        if (nextChapter != null && phase.state != PlanPhase.State.CURRENT) {
            stringResource(R.string.plan_up_next_suffix)
        } else {
            phaseStateWords(phase.state)
        }
    val color = if (phase.state == PlanPhase.State.DONE) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface

    ListRow(
        chevronSpace = true,
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
        // Open, the fold under it names what the left-out line counts.
        supporting =
            if (line == null && (leftOutTopics == 0 || expanded == true)) {
                null
            } else {
                {
                    line?.let { Text(it.text, Modifier.semantics { contentDescription = it.spoken }) }
                    if (expanded != true) LeftOutTopicsLine(leftOutTopics)
                }
            },
        meta = date?.let { { TrailingText(it) } },
        // Main's PathRowBody gives its titles 9rem. Scale the base size before multiplying because Android scales text nonlinearly.
        headlineBasis = with(LocalDensity.current) { 16.sp.toDp() * 9 },
    )
}

/** How many of a phase's topics its row's line says the plan's date leaves out: none when another reason speaks for it, as main's `PhaseLeftOut`. */
internal fun leftOutLine(phase: PlanPhase): Int =
    when {
        phase.state == PlanPhase.State.LEFT_OUT || phase.state == PlanPhase.State.UNFINISHED || phase.challengeLeftOut -> 0
        else -> phase.leftOut.size
    }

/** Main's `usePhaseEnd`: when a phase ends ([phaseEnd]'s rule), the same wherever it shows: a short plan's days or its end ("~Nov 10", "~Jan"). */
@Composable
internal fun phaseEnd(
    page: PlanPageState,
    phase: PlanPhase,
): PlanDateWords? = phaseEnd(page.plan, phase, page.today)

@Composable
fun phaseEnd(
    plan: Plan,
    phase: PlanPhase,
    today: LocalDate,
): PlanDateWords? =
    when (val end = plan.phaseEnd(phase)) {
        null -> {
            null
        }

        is PhaseEnd.Days -> {
            shortDays(plan, phase)?.let(::sameWords)
        }

        PhaseEnd.Later -> {
            laterWords()
        }

        is PlanEnd -> {
            endWords(
                formatPlanDate(end.date, today, currentLocale(), month = end.month, year = end.year),
                end.estimate,
                end.month || end.year,
            )
        }
    }

/** An end not in the plan yet: its work is still owed, past the years the plan lays out. */
@Composable
internal fun laterWords() = PlanDateWords(stringResource(R.string.plan_later), stringResource(R.string.plan_ends_later))

/** A phase's or the goal's end as it's shown ("Nov 10", "~Nov 10") and as TalkBack says it ("Ends about Nov 10"). */
@Composable
fun endWords(
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
    if (phase.state == PlanPhase.State.LEFT_OUT) {
        return sameWords(planOutsideReason(phase.notPlannedReason, module = !page.isExam))
    }
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
    // Its left-out line says so, drawn with the fold's mark ([LeftOutTopicsLine]).
    if (phase.leftOut.isNotEmpty()) return null
    // Main's `PhaseResume`: nothing continues while the goal is paused.
    if (phase.state != PlanPhase.State.CURRENT || open || page.isPaused) return null

    if (phase.lessonsDone < phase.lessonsTotal) {
        val resumes =
            phase.chapters
                .filter { it.state != PlanPhaseChaptersInner.State.DONE }
                .mapNotNull { it.nextDate?.toJavaLocalDate() }
                .minOrNull() ?: return null
        return sameWords(
            if (resumes == page.today) {
                stringResource(R.string.plan_continues_today)
            } else {
                stringResource(R.string.plan_continues_on, formatPlanDate(resumes, page.today, currentLocale()))
            },
        )
    }
    return null
}

internal fun sameWords(text: String) = PlanDateWords(text, text)

@Composable
private fun PhaseMark(phase: PlanPhase) {
    when (phase.state) {
        PlanPhase.State.DONE -> StatusMark(MarkStatus.Done)
        PlanPhase.State.CURRENT -> CurrentPhaseMark()
        else -> StatusMark(MarkStatus.Todo)
    }
}

/** Main's `CurrentPhaseMark`: where the learner is in the plan, an ink dot in a faint ring of its ink. */
@Composable
private fun CurrentPhaseMark() {
    val ink = MaterialTheme.colorScheme.onSurface
    Canvas(Modifier.size(markSize())) {
        drawCircle(ink.copy(alpha = CURRENT_RING_ALPHA), radius = (CURRENT_DOT + CURRENT_RING).toPx())
        drawCircle(ink, radius = CURRENT_DOT.toPx())
    }
}

private val CURRENT_DOT = 5.dp
private val CURRENT_RING = 4.dp
private const val CURRENT_RING_ALPHA = 0.15f

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

/**
 * Main's list footer that shows the chapters left out: its words start where the rows' titles do, and it ends in the
 * fold arrow every fold row ends in. With [open] it folds them away again, and TalkBack hears whether it's open.
 */
@Composable
internal fun MoreChaptersRow(
    text: String,
    open: Boolean = false,
    indent: Dp = 0.dp,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        onClick = onClick,
        indent = indent,
        expanded = open,
        leading = { Box(Modifier.size(MARK_COLUMN)) },
    )
}

private val MARK_COLUMN = 24.dp

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
    phase: PlanPhase,
    links: PlanLinks,
    indent: Dp = 0.dp,
    brief: Boolean = false,
) {
    var showAll by rememberSaveable { mutableStateOf(false) }
    val rows = phase.chapters.filterNot { it.isWritingAhead }
    val window = chapterWindow(rows.map { it.state })
    val hidden = rows.size - (window.last - window.first + 1).coerceAtLeast(0)
    val shown = if (showAll) rows else rows.slice(window)
    val units = page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE

    Column {
        shown.forEach { ChapterRow(it, links, indent) }
        if (hidden > 0) {
            MoreChaptersRow(
                text =
                    when {
                        showAll && units -> stringResource(R.string.plan_show_fewer_units)
                        showAll -> stringResource(R.string.plan_show_fewer_chapters)
                        units -> pluralStringResource(R.plurals.plan_more_units, hidden, hidden)
                        else -> pluralStringResource(R.plurals.plan_more_chapters, hidden, hidden)
                    },
                open = showAll,
                indent = indent,
            ) { showAll = !showAll }
        }
        LeftOutTopicsRow(phase.leftOut, indent)
        phase.checkpoint?.let { CheckpointRow(page, phase, it, links, indent, brief) }
    }
}

/** Main's left-out row: the topics the plan's date leaves out of a phase or a module, folded under one row that names them. */
@Composable
internal fun LeftOutTopicsRow(
    names: List<String>,
    indent: Dp,
) {
    if (names.isEmpty()) return
    var open by rememberSaveable { mutableStateOf(false) }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column {
        ListRow(
            headline = { Text(pluralStringResource(R.plurals.plan_left_out_topics, names.size, names.size), color = muted) },
            onClick = { open = !open },
            indent = indent,
            expanded = open,
            leading = { LeftOutMark(FOLD_MARK) },
        )
        if (open) FoldedNames(names, indent)
    }
}

/**
 * Main's `LeftOutTopicsLine`: under a module's or a phase's name, how many of its topics the plan's date leaves out,
 * after the fold's mark so it reads as a different line from what the row holds.
 */
@Composable
internal fun LeftOutTopicsLine(count: Int) {
    if (count == 0) return
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        LeftOutMark(LINE_MARK)
        Text(
            pluralStringResource(R.plurals.plan_left_out_topics, count, count),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Main's `CircleMinusIcon` at 70% of the muted ink, as a topic left out of the plan is marked. */
@Composable
private fun LeftOutMark(size: Dp) {
    Icon(
        painterResource(R.drawable.ic_do_not_disturb_on),
        contentDescription = null,
        modifier = Modifier.size(size * glyphScale()),
        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
    )
}

/** The glyph's ink is 20/24 of its box: 16dp draws main's 13dp list mark, 12dp its 10dp line mark. */
private val FOLD_MARK = 16.dp
private val LINE_MARK = 12.dp

/** Main's `FoldedNames`: names a fold opens to, which open nothing themselves, as one quiet list of bullets hanging off the rows' title edge. */
@Composable
private fun FoldedNames(
    names: List<String>,
    indent: Dp,
) {
    val style = MaterialTheme.typography.bodyMedium
    Column(
        Modifier.padding(start = indent + listRowWordsStart() - BULLET_WIDTH - BULLET_GAP, end = LIST_ITEM_INSET, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurfaceVariant) {
            names.forEach { name ->
                Row(horizontalArrangement = Arrangement.spacedBy(BULLET_GAP)) {
                    Text("•", Modifier.width(BULLET_WIDTH).clearAndSetSemantics {}, style = style)
                    Text(name, style = style)
                }
            }
        }
    }
}

private val BULLET_WIDTH = 8.dp
private val BULLET_GAP = 6.dp

/** Without [links] the row only says what's there, and opens nothing. */
@Composable
internal fun ChapterRow(
    chapter: PlanPhaseChaptersInner,
    links: PlanLinks?,
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
                links == null -> null
                chapter.writing && skillId != null -> links.farTopic(FarTopic(skillId, title, chapter.plannedLessons, chapter.nextDate))
                chapterId != null -> ({ links.chapter(chapterId) })
                else -> null
            },
        highlighted = isNext && opensChapter && links != null,
        indent = indent,
        leading = { ChapterMark(chapter, isNext) },
        supporting = listRowDescription(line),
    )
}

/** Main's `PhaseCheckpointMark`: what ends a phase, a call for a language and the Trickster's face otherwise, wherever the plan shows it. */
@Composable
internal fun PhaseCheckpointMark(
    page: PlanPageState,
    modifier: Modifier,
) {
    if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) {
        Icon(painterResource(R.drawable.ic_mic), contentDescription = null, modifier = modifier)
    } else {
        Trickster(modifier, face = true)
    }
}

/** A phase's challenge by its one name: the Trickster, or a language plan's call. */
@Composable
internal fun challengeName(page: PlanPageState): String =
    stringResource(if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) R.string.session_block_call else R.string.checkpoint_trickster)

/** The legend names the mark by what it is: the Trickster's name waits for his intro, while a language plan's call is already its name. */
@Composable
internal fun legendChallengeName(page: PlanPageState): String =
    if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) challengeName(page) else stringResource(R.string.plan_legend_phase_questions)

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
    phase: PlanPhase,
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
            done -> {
                sameWords(stringResource(R.string.plan_challenge_won))
            }

            // A paused plan has nothing planned until the learner resumes, as [PhaseRow]'s end.
            page.isPaused -> {
                null
            }

            // Dated today, the next session is today's, which may already be under way.
            whenPlanned == PlanPhaseCheckpoint.`When`.NEXT_SESSION && date == page.today -> {
                sameWords(stringResource(R.string.plan_today))
            }

            whenPlanned == PlanPhaseCheckpoint.`When`.NEXT_SESSION -> {
                sameWords(stringResource(R.string.plan_challenge_next_session))
            }

            else -> {
                when (val day = page.plan.challengeDay(phase)) {
                    PhaseEnd.Later -> sameWords(stringResource(R.string.plan_later))
                    is PlanEnd -> planDate(day.date, page.today, day.estimate, day.month, day.year)
                    else -> null
                }
            }
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
        )

    ListRow(
        chevronSpace = true,
        headline = {
            Text(
                text = challengeName(page),
                color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
        },
        onClick = planItemId?.let { { links.challenge(it) } },
        indent = indent,
        leading = { PhaseCheckpointMark(page, Modifier.size(markSize())) },
        supporting = if (lines.isEmpty()) null else ({ lines.forEach { Text(it) } }),
        meta =
            trailing?.let { { TrailingText(it) } },
    )
}

@Composable
internal fun MockRow(
    page: PlanPageState,
    date: LocalDate,
    links: PlanLinks,
    itemId: UUID?,
) {
    val funded = page.plan.fundedMocks.firstOrNull { it.scheduledFor?.toJavaLocalDate() == date }
    val scheduled = itemId ?: funded?.id
    val onClick: (() -> Unit)? =
        when {
            scheduled != null -> {
                { links.challenge(scheduled.toString()) }
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
        chevronSpace = true,
        headline = { Text(stringResource(R.string.plan_mock_exam)) },
        onClick = onClick,
        leading = { KindMark(LearnKind.Mock) },
        supporting = minutes?.let { { Text(formatMinutes(it.roundToInt(), locale)) } },
        meta = { TrailingText(planDate(date, page.today)) },
    )
    if (scheduled != null && links.scheduleMock != null && (funded == null || funded.status == PlanFundedMocksInner.Status.TODO)) {
        TextButton(onClick = { links.scheduleMock.invoke(scheduled.toString()) }) {
            Text(stringResource(R.string.mock_schedule_change))
        }
    }
}

@Composable
private fun FinishItem(
    page: PlanPageState,
    links: PlanLinks,
    inSheet: Boolean,
) {
    val finish =
        page.finish?.let { planDate(it.date, page.today, it.estimate, it.month, it.year) }
            ?: when {
                page.isExam -> sameWords(stringResource(R.string.plan_date_to_be_confirmed))
                page.plan.forecast == PlanForecast.Beyond && !page.isPaused -> laterWords()
                else -> null
            }

    ListRow(
        chevronSpace = true,
        headline = { Text(page.goal.displayName) },
        onClick = if (links.hasExam) links::exam else null,
        leading = { FlagMark() },
        // On the page, More's row or the menu says "About the exam"; the phases sheet has neither, so its row says it.
        supporting = if (links.hasExam && inSheet) ({ Text(stringResource(R.string.plan_about_exam)) }) else null,
        meta = finish?.let { { TrailingText(it) } },
    )
}

@Composable
internal fun FlagMark() {
    MarkIcon(R.drawable.ic_flag)
}

internal val SHEET_MARGIN = 24.dp

@Composable
internal fun MetaLine(
    text: String,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = color)
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
    // Main's `PhaseDetails`: a phase named like one of the chapters listed under it goes by its place; the current one keeps its name, as the band and the phase line give it.
    val byPlace = learn && phase.state != PlanPhase.State.CURRENT && phase.isNamedLikeAChapter(name)
    // From the phase's start to the end it's named by everywhere, or a short plan's days.
    val range =
        when (val end = page.plan.phaseEnd(phase).takeUnless { page.isPaused }) {
            null -> {
                null
            }

            is PhaseEnd.Days, PhaseEnd.Later -> {
                phaseEnd(page, phase)?.text
            }

            is PlanEnd -> {
                phase.start?.let { start ->
                    stringResource(
                        R.string.plan_date_range,
                        // Main's `getPhaseStart`: a phase ahead starts where the one before it ends, so it's an estimate whenever its end is.
                        planDate(start, page.today, end.estimate && phase.state == PlanPhase.State.UPCOMING, end.month, end.year).text,
                        planDate(end.date, page.today, end.estimate, end.month, end.year).text,
                    )
                }
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
            text = phaseRowName(phase, page.mocksRequirePlus, byPlace),
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
            PhaseChapters(page, phase, links)
        } else {
            phase.mocks.nextDate?.let { MockRow(page, it.toJavaLocalDate(), links, phase.mocks.nextPlanItemId) }
            if (phase.mocks.nextDate == null && phase.mocks.count > 0) {
                Row(
                    modifier = Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MetaLine(pluralStringResource(R.plurals.plan_mock_exams_count, phase.mocks.count.toInt(), phase.mocks.count.toInt()))
                }
            }
            phase.checkpoint?.let { CheckpointRow(page, phase, it, links) }
        }
    }
}
