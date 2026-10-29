package com.zoonk.android.feature.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.feature.session.BlockMark
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.FreshStart
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.blockDetail
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.challengePhase
import com.zoonk.android.feature.session.learnKind
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyExtraTimeLessonsInner
import kotlinx.datetime.toJavaLocalDate

/** Which of the queue's folds are open, kept with the screen's saved state. */
@Immutable
internal data class TodayFolds(
    val doneOpen: Boolean,
    val moreOpen: Boolean,
    val toggleDone: () -> Unit,
    val toggleMore: () -> Unit,
)

internal fun LazyListScope.todaySession(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    folds: TodayFolds,
    wide: Boolean,
    buddyName: String,
) {
    val day = model.day
    val next = day.nextStep?.takeIf { !model.session.limitReached }

    if (model.today.earlierWork.isNotEmpty()) {
        item(key = "earlier-work", contentType = "earlier-work") { EarlierWork(model, Modifier.pageItem().padding(top = 16.dp)) }
    }

    freshStartItem(model)

    if (day.steps.size >= 2) {
        item(key = "segments", contentType = "segments") { DaySegments(model, Modifier.pageItem().padding(top = 20.dp)) }
    }

    if (wide && day.steps.isNotEmpty()) {
        item(key = "meta", contentType = "meta") { DayMeta(model, Modifier.pageItem().padding(top = 8.dp)) }
    }

    if (next != null) {
        sessionQueue(model, next, viewModel, actions, folds, wide)
    } else {
        items(day.steps, key = { "step-${it.position}" }, contentType = { "step" }) { step ->
            StepRow(model, step, isNext = false, opens = false, busy = false, onOpen = {}, Modifier.pageItem())
        }
        plusLessons(day.plusLessons, actions, visible = day.plusLessons.size)
    }

    if (day.lessonsComing) {
        item(key = "so-far", contentType = "note") { DaySoFar(model, Modifier.pageItem().padding(top = 8.dp)) }
    }

    item(key = "status", contentType = "status") { TodayDayStatus(model, actions, Modifier.pageItem().padding(top = 12.dp)) }

    if (model.upNext.isNotEmpty()) {
        upNext(model.upNext, busy = viewModel.pending == TodayTap.KeepLearning, actions)
    }

    item(key = "more", contentType = "more") { TodayMore(model, viewModel, actions, buddyName, Modifier.pageItem().padding(top = 16.dp)) }
}

private fun LazyListScope.freshStartItem(model: TodayDayModel) {
    val day = model.day
    val started = day.steps.any { it.status != StudyBlock.Status.PENDING }
    val shows = day.freshStart != null && !model.today.studiedToday && !started

    if (!shows || model.session.ahead || model.session.limitReached || model.session.rest) return

    item(key = "fresh-start", contentType = "note") {
        val time = formatMinutes(day.steps.sumOf { it.estimatedMinutes }.toInt(), currentLocale())
        val text =
            when (day.freshStart) {
                FreshStart.WelcomeBack -> {
                    // Past a free exam plan's first week, it's shorter for what Plus holds, not the break.
                    val trialEnded = day.examAccess.trialEnded
                    stringResource(
                        if (trialEnded) R.string.today_fresh_start_welcome_back_trial_ended else R.string.today_fresh_start_welcome_back,
                        time,
                    )
                }

                FreshStart.NewPhase -> {
                    stringResource(R.string.today_fresh_start_new_phase)
                }

                FreshStart.NewWeek -> {
                    stringResource(R.string.today_fresh_start_new_week)
                }
            }

        Row(Modifier.pageItem().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                painterResource(R.drawable.ic_wb_twilight),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/**
 * The fold never hides a block a mission opens: where the missions card leaves its rows to the
 * queue, that block is the mission's one place.
 */
private fun LazyListScope.sessionQueue(
    model: TodayDayModel,
    next: DayStep,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    folds: TodayFolds,
    wide: Boolean,
) {
    val queue = model.day.queue(next.position)
    val foldsDone = !wide && queue.done.size > PHONE_DONE_ROWS
    val marked = queue.after.indexOfLast { model.countsTowardMission(it) } + 1
    val rows = (if (wide) WIDE_UPCOMING_ROWS else PHONE_UPCOMING_ROWS).coerceAtLeast(marked)
    val upcoming = queue.after.size + model.day.plusLessons.size
    val more = (upcoming - rows).coerceAtLeast(0)
    val shownAfter = if (folds.moreOpen) queue.after else queue.after.take(rows)
    val pending = (viewModel.pending as? TodayTap.Step)?.position

    item(key = "queue-top", contentType = "spacer") { Box(Modifier.padding(top = 12.dp)) }

    if (foldsDone) {
        item(key = "fold-done", contentType = "fold") {
            FoldRow(
                label = pluralStringResource(R.plurals.today_done_count, queue.done.size, queue.done.size),
                done = true,
                open = folds.doneOpen,
                minutes = null,
                onToggle = folds.toggleDone,
                modifier = Modifier.pageItem(),
            )
        }
    }

    val rowsShown = (if (!foldsDone || folds.doneOpen) queue.done else emptyList()) + queue.before + next + shownAfter

    val beforeNext = rowsShown.indexOf(next) - 1

    itemsIndexed(rowsShown, key = { _, step -> "step-${step.position}" }, contentType = { _, _ -> "step" }) { index, step ->
        val isNext = step.position == next.position
        StepRow(
            model = model,
            step = step,
            isNext = isNext,
            opens = !step.isFinished && step.waitReason == null,
            busy = pending == step.position || (isNext && viewModel.pending == TodayTap.Continue),
            onOpen = { actions.open(step) },
            modifier = Modifier.pageItem(),
            onNavigate = actions.navigate,
            divider = index != beforeNext,
        )
    }

    plusLessons(
        model.day.plusLessons,
        actions,
        visible = if (folds.moreOpen) model.day.plusLessons.size else (rows - queue.after.size).coerceAtLeast(0),
    )

    if (more > 0) {
        item(key = "fold-more", contentType = "fold") {
            FoldRow(
                label = pluralStringResource(R.plurals.today_more_count, more, more),
                done = false,
                open = folds.moreOpen,
                minutes = queue.after.drop(rows).sumOf { it.estimatedMinutes },
                onToggle = folds.toggleMore,
                modifier = Modifier.pageItem(),
            )
        }
    }
}

/** Not part of the session: never the next block, no mission mark, and the day's time leaves them out. */
private fun LazyListScope.plusLessons(
    titles: List<String>,
    actions: TodayActionHandlers,
    visible: Int,
) {
    items(titles.take(visible).withIndex().toList(), key = { "plus-${it.index}" }, contentType = { "plus" }) { (_, title) ->
        RowFrame(isNext = false, busy = false, onClick = { actions.navigate(AppRoute.Subscription) }, modifier = Modifier.pageItem()) {
            RowMark { KindMark(LearnKind.Lesson) }
            Text(
                text = title,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleSmall,
            )
            LabelChip(text = stringResource(R.string.today_step_plus))
        }
    }
}

private fun LazyListScope.upNext(
    lessons: List<StudyExtraTimeLessonsInner>,
    busy: Boolean,
    actions: TodayActionHandlers,
) {
    item(key = "up-next-title", contentType = "title") {
        Text(
            text = stringResource(R.string.today_up_next),
            modifier = Modifier.pageItem().padding(top = 24.dp, bottom = 8.dp).semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
    }

    items(lessons.withIndex().toList(), key = { "up-next-${it.index}" }, contentType = { "up-next" }) { (index, lesson) ->
        val first = index == 0
        RowFrame(
            isNext = first,
            busy = first && busy,
            onClick = if (first) actions.keepLearning else null,
            modifier = Modifier.pageItem(),
        ) {
            RowMark { KindMark(LearnKind.Lesson) }
            Text(
                text = lesson.title,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleSmall,
            )
            Minutes(lesson.minutes)
        }
    }
}

internal fun TodayDayModel.countsTowardMission(step: DayStep): Boolean =
    !day.fullMeal.earned && day.missions.any { mission -> !mission.done && mission.waitReason == null && mission.opens.opensStep(step) }

private fun MissionOpens?.opensStep(step: DayStep): Boolean =
    when {
        this !is MissionOpens.Block -> false
        blockId != null -> blockId == step.id
        else -> position == step.position
    }

/** A finished row shows no minutes: they were the plan's estimate, not the time it took. */
@Composable
private fun StepRow(
    model: TodayDayModel,
    step: DayStep,
    isNext: Boolean,
    opens: Boolean,
    busy: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier,
    onNavigate: (AppRoute) -> Unit = {},
    divider: Boolean = true,
) {
    val finished = step.isFinished
    val mission = model.countsTowardMission(step)
    val state =
        when (step.status) {
            StudyBlock.Status.COMPLETED -> stringResource(R.string.today_step_done)
            StudyBlock.Status.SKIPPED -> stringResource(R.string.today_step_skipped)
            else -> if (isNext) stringResource(R.string.today_step_next) else null
        }

    RowFrame(
        isNext = isNext,
        busy = busy,
        onClick = if (opens) onOpen else null,
        modifier = modifier.semantics { if (state != null) stateDescription = state },
        divider = divider,
    ) {
        RowMark { BlockMark(step) }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = blockTitle(step),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = if (finished) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleSmall,
            )

            if (!finished) StepLines(model, step)
            if (isNext && step.canTestOut && step.chapterId != null) TestOutLink(model, step.chapterId, onNavigate)
        }

        if (!finished) {
            if (mission) {
                Icon(
                    painter = painterResource(R.drawable.ic_target),
                    contentDescription = stringResource(R.string.today_step_counts_toward_mission),
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.zoonk.brain,
                )
            }
            Minutes(step.estimatedMinutes)
        }
    }
}

@Composable
private fun StepLines(
    model: TodayDayModel,
    step: DayStep,
) {
    val wait = step.waitReason
    val phase = step.challengePhase
    val line =
        when {
            wait == StudyBlock.WaitReason.LESSONS -> {
                phase?.let { stringResource(R.string.today_step_after_lessons_phase, it) }
                    ?: stringResource(R.string.today_step_after_lessons)
            }

            wait == StudyBlock.WaitReason.CHALLENGE -> {
                phase?.let { stringResource(R.string.today_step_after_challenge_phase, it) }
                    ?: stringResource(R.string.today_step_after_challenge)
            }

            !model.writingStalled && step.isBeingWritten(model.today.lessonStatus) -> {
                stringResource(R.string.today_step_being_written)
            }

            else -> {
                rowLabel(model, step)
            }
        }
    val reviewDetail = if (step.weakest || step.fullReview) blockDetail(step) else null

    if (line != null) SubLine(line)
    if (reviewDetail != null) SubLine(reviewDetail)
}

/** Earlier unfinished lessons, which the session fits into today's time once it starts; a long list starts folded. */
@Composable
private fun EarlierWork(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val items = model.today.earlierWork
    var open by rememberSaveable { mutableStateOf(items.size <= OPEN_BACKLOG_LIMIT) }
    val count = formatNumber(items.size.toDouble(), currentLocale())

    Column(modifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button) { open = !open }
                    .heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.today_earlier_work, count), style = MaterialTheme.typography.titleSmall)
            Icon(
                painter = painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(18.dp).rotate(if (open) 180f else 0f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (open) {
            Text(
                text = stringResource(R.string.today_earlier_work_detail),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items.forEach { Text(it.title, style = MaterialTheme.typography.bodyMedium) }
            }
        }
        HorizontalDivider(Modifier.padding(top = 12.dp))
    }
}

/** The test that skips the chapter, offered on the next lesson unless it was failed today. */
@Composable
private fun TestOutLink(
    model: TodayDayModel,
    chapterId: java.util.UUID,
    onNavigate: (AppRoute) -> Unit,
) {
    val take = stringResource(R.string.today_take_the_test)
    val text =
        buildAnnotatedString {
            append(stringResource(R.string.today_already_know_this))
            append(" ")
            withLink(
                LinkAnnotation.Clickable(
                    tag = "test-out",
                    styles = TextLinkStyles(SpanStyle(fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline)),
                ) { onNavigate(AppRoute.TestOut(chapterId.toString(), model.day.sessionId?.toString())) },
            ) { append(take) }
        }

    Text(
        text,
        modifier = Modifier.padding(top = 6.dp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun rowLabel(
    model: TodayDayModel,
    step: DayStep,
): String? {
    val catchingUp =
        model.day.catchUp
            ?.positions
            ?.contains(step.position) == true
    val label =
        when {
            !catchingUp -> step.subject ?: step.challengePhase
            step.subject != null -> stringResource(R.string.today_step_catching_up_subject, step.subject)
            else -> stringResource(R.string.today_step_catching_up)
        }

    return when {
        !step.oftenTested -> label
        label != null -> stringResource(R.string.today_step_often_tested_label, label)
        else -> stringResource(R.string.today_step_often_tested)
    }
}

@Composable
private fun SubLine(text: String) {
    Text(
        text = text,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

/** One width for every mark, growing with the font, so the rows' titles start in one place. */
@Composable
internal fun RowMark(content: @Composable () -> Unit) {
    val width = with(LocalDensity.current) { MARK_WIDTH.toDp() }
    Box(Modifier.width(width).heightIn(min = width), contentAlignment = Alignment.Center) { content() }
}

/** The next block sits on a tinted card; the others are separated by hairlines. */
@Composable
private fun RowFrame(
    isNext: Boolean,
    busy: Boolean,
    onClick: (() -> Unit)?,
    modifier: Modifier,
    divider: Boolean = true,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Column(modifier) {
        Row(
            modifier =
                Modifier
                    .then(if (isNext) Modifier.bleed(NEXT_BLEED) else Modifier.fillMaxWidth())
                    .then(
                        if (isNext) {
                            Modifier.background(
                                MaterialTheme.colorScheme.surfaceContainerHigh,
                                MaterialTheme.shapes.medium,
                            )
                        } else {
                            Modifier
                        },
                    ).clip(MaterialTheme.shapes.medium)
                    .then(if (onClick != null) Modifier.clickable(enabled = !busy, role = Role.Button, onClick = onClick) else Modifier)
                    .alpha(if (busy) BUSY_ALPHA else 1f)
                    .heightIn(min = 48.dp)
                    .padding(horizontal = if (isNext) NEXT_BLEED else 0.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = if (isNext) Alignment.Top else Alignment.CenterVertically,
        ) {
            content()
        }

        if (!isNext && divider) HorizontalDivider()
    }
}

/** The next block's tint reaches past the column, so its mark and words stay on every row's edges. */
private fun Modifier.bleed(horizontal: Dp): Modifier =
    layout { measurable, constraints ->
        val extra = (horizontal * 2).roundToPx()
        val width = constraints.maxWidth + extra
        val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
        layout(constraints.maxWidth, placeable.height) { placeable.placeRelative(-extra / 2, 0) }
    }

@Composable
private fun Minutes(minutes: Long) {
    Text(
        text = formatMinutes(minutes.toInt(), currentLocale()),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
    )
}

/** Only time still ahead says its minutes: a done row's are the plan's estimate. */
@Composable
private fun FoldRow(
    label: String,
    done: Boolean,
    open: Boolean,
    minutes: Long?,
    onToggle: () -> Unit,
    modifier: Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(MaterialTheme.shapes.medium)
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics {
                    if (open) {
                        collapse { onToggle().let { true } }
                    } else {
                        expand { onToggle().let { true } }
                    }
                }.heightIn(min = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RowMark { if (done) DoneMark() }
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleSmall)
            Icon(
                painter = painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(18.dp).rotate(if (open) 180f else 0f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (minutes != null && minutes > 0) Minutes(minutes)
    }
}

@Composable
private fun DaySegments(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val day = model.day
    val done = day.steps.count(DayStep::isFinished)
    val tertiary = MaterialTheme.colorScheme.tertiary
    val skipped = MaterialTheme.colorScheme.onSurface.copy(alpha = SKIPPED_ALPHA)
    val parts =
        day.steps.map { step ->
            val current = step.position == day.nextPosition
            val fill =
                when {
                    step.status == StudyBlock.Status.COMPLETED -> MeterPart.Fill.Solid(tertiary)
                    step.status == StudyBlock.Status.SKIPPED -> MeterPart.Fill.Solid(skipped)
                    current -> MeterPart.Fill.Place(step.share)
                    step.learnKind == LearnKind.Lesson -> MeterPart.Fill.Track
                    else -> MeterPart.Fill.Solid(step.learnKind.color.copy(alpha = AHEAD_ALPHA))
                }
            MeterPart(fill, weight = step.estimatedMinutes.coerceAtLeast(1).toFloat())
        }

    MeterParts(parts, modifier, contentDescription = stepsDone(done, day.steps.size))
}

private val DayStep.share: Float
    get() = if (status != StudyBlock.Status.ACTIVE || questions == 0L) 0f else (answered.toFloat() / questions).coerceAtMost(1f)

@Composable
private fun stepsDone(
    done: Int,
    total: Int,
): String {
    val locale = currentLocale()
    return stringResource(R.string.today_steps_done, formatNumber(done.toDouble(), locale), formatNumber(total.toDouble(), locale))
}

@Composable
private fun DayMeta(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val done = model.day.steps.count(DayStep::isFinished)

    Row(modifier, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = stepsDone(done, model.day.steps.size),
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
        DayTime(model, MaterialTheme.typography.titleLarge)
    }
}

/** How many parts the day holds so far: "More on the way" read as a delivery already running. */
@Composable
private fun DaySoFar(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val steps = model.day.steps
    val count = steps.size
    val text =
        if (steps.all { it.kind == StudyBlock.Kind.LEARN }) {
            pluralStringResource(R.plurals.today_lessons_so_far, count, count)
        } else {
            pluralStringResource(R.plurals.today_activities_so_far, count, count)
        }

    Text(
        text = text,
        modifier = modifier,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
    )
}

@Composable
private fun TodayDayStatus(
    model: TodayDayModel,
    actions: TodayActionHandlers,
    modifier: Modifier,
) {
    val day = model.day
    val pastDate = model.pastDate?.toInt()

    if (pastDate != null) {
        val sentence =
            if (model.today.goal.kind == com.zoonk.api.models.TodayGoal.Kind.EXAM) {
                pluralStringResource(R.plurals.today_past_date_exam, pastDate, pastDate)
            } else {
                pluralStringResource(R.plurals.today_past_date, pastDate, pastDate)
            }
        TodayStatusLine(R.drawable.ic_event_upcoming, sentence, stringResource(R.string.today_past_date_detail), modifier)
        return
    }

    when (model.state) {
        DayState.Done -> {
            val studied = day.studiedToday()
            val summary = stringResource(R.string.today_see_summary)
            val link =
                if (model.keepLearning) {
                    buildAnnotatedString {
                        withLink(
                            LinkAnnotation.Clickable(
                                tag = "summary",
                                styles =
                                    TextLinkStyles(
                                        SpanStyle(fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline),
                                    ),
                            ) { actions.navigate(AppRoute.Session(goalId = (day.goalId ?: model.today.goal.id).toString())) },
                        ) { append(summary) }
                    }
                } else {
                    null
                }
            TodayStatusLine(
                icon = null,
                sentence = stringResource(if (day.minutes.dailyGoal == 0.0) R.string.today_done_day_off else R.string.today_done),
                clause = if (studied > 0) formatMinutes(studied.toInt(), currentLocale()) else null,
                modifier = modifier,
                leading = { DoneMark() },
                link = link,
            )
        }

        DayState.Waiting -> {
            if (model.writingStalled) {
                TodayStatusLine(
                    R.drawable.ic_schedule,
                    stringResource(R.string.today_waiting_stalled),
                    stringResource(R.string.today_waiting_stalled_detail),
                    modifier,
                )
            } else {
                TodayStatusLine(
                    icon = null,
                    sentence = stringResource(R.string.today_waiting),
                    clause = stringResource(R.string.today_waiting_detail),
                    modifier = modifier,
                    leading = { CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) },
                )
            }
        }

        DayState.Limit -> {
            TodayStatusLine(R.drawable.ic_hourglass_empty, stringResource(R.string.today_limit), seeYou(model), modifier)
        }

        DayState.Rest -> {
            val welcomeBack = day.freshStart == FreshStart.WelcomeBack
            val clause =
                when {
                    model.keepLearning && welcomeBack -> R.string.today_rest_next_lessons_welcome_back
                    model.keepLearning -> R.string.today_rest_next_lessons
                    welcomeBack -> R.string.today_rest_welcome_back
                    else -> R.string.today_rest_enjoy
                }
            TodayStatusLine(R.drawable.ic_dark_mode, stringResource(R.string.today_rest), stringResource(clause), modifier)
        }

        // A free exam plan past its first week has its new lessons locked above, so it never claims they're all done.
        DayState.Ahead -> {
            if (day.examAccess.trialEnded) {
                TodayStatusLine(R.drawable.ic_auto_awesome, stringResource(R.string.today_nothing_to_review), null, modifier)
            } else {
                TodayStatusLine(
                    R.drawable.ic_auto_awesome,
                    stringResource(R.string.today_nothing_new),
                    stringResource(R.string.today_nothing_new_detail),
                    modifier,
                )
            }
        }

        DayState.Underway -> {}
    }
}

/** "See you tomorrow!" only when tomorrow is a study day; else the plan's next day by name, or the next session. */
@Composable
private fun seeYou(model: TodayDayModel): String {
    val week = model.day.week
    val next = week.nextStudyDate ?: return stringResource(R.string.today_see_you_next_session)
    val today = week.days.firstOrNull { it.isToday }?.date ?: model.day.localDate

    if (next.toEpochDays() - today.toEpochDays() == 1L) return stringResource(R.string.today_see_you_tomorrow)

    val date = next.toJavaLocalDate()
    return stringResource(R.string.today_see_you_day, formatDate(date, currentLocale(), DateStyle.Weekday, date))
}

private val MARK_WIDTH = 20.sp
private val NEXT_BLEED = 10.dp

private const val PHONE_DONE_ROWS = 2
private const val OPEN_BACKLOG_LIMIT = 5
private const val PHONE_UPCOMING_ROWS = 6
private const val WIDE_UPCOMING_ROWS = 12
private const val BUSY_ALPHA = 0.6f
private const val SKIPPED_ALPHA = 0.25f
private const val AHEAD_ALPHA = 0.5f
