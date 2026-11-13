package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.liveRegion
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
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.BlockMark
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.FreshStart
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.SessionBar
import com.zoonk.android.feature.session.StepOpenFailed
import com.zoonk.android.feature.session.blockDetail
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.challengePhase
import com.zoonk.android.feature.session.drawsDayProgress
import com.zoonk.android.feature.session.practisesTopics
import com.zoonk.android.feature.session.shortTopicList
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.components.statusLink
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.spaceAfterSentence
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyExtraTimeLessonsInner
import com.zoonk.api.models.StudySession
import kotlinx.datetime.toJavaLocalDate

internal fun LazyListScope.todaySession(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    list: LazyListState,
    buddyName: String,
) {
    val day = model.day

    if (model.today.earlierWork.isNotEmpty()) {
        item(key = "earlier-work", contentType = "earlier-work") { EarlierWork(model, Modifier.pageItem().padding(top = 16.dp)) }
    }

    freshStartItem(model)

    if (drawsDayProgress(day.sessionBar.total, held = day.heldMinutes > 0)) {
        item(key = "segments", contentType = "segments") { TodayDayProgress(model, Modifier.pageItem().padding(top = 20.dp)) }
    }

    sessionQueue(model, day.nextStep, viewModel, actions, list)

    item(key = "status", contentType = "status") { TodayDayStatus(model, actions, Modifier.pageItem().padding(top = 12.dp)) }

    if (model.upNext.isNotEmpty()) {
        upNext(model.upNext, viewModel.pending, failed = viewModel.failed == TodayTap.UpNext, actions)
    }

    item(key = "more", contentType = "more") { TodayMore(model, viewModel, actions, buddyName, Modifier.pageItem().padding(top = 16.dp)) }
}

private fun LazyListScope.freshStartItem(model: TodayDayModel) {
    val day = model.day
    val freshStart = day.freshStart ?: return

    if (!day.showsFreshStart(model.today.studiedToday) || model.state == StudySession.State.AHEAD ||
        model.state == StudySession.State.REST
    ) {
        return
    }

    item(key = "fresh-start", contentType = "note") {
        val time = formatMinutes(day.minutes.left, currentLocale())
        val text =
            when (freshStart) {
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

private fun LazyListScope.sessionQueue(
    model: TodayDayModel,
    next: DayStep?,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    list: LazyListState,
) {
    if (model.day.steps.isEmpty() && model.day.plusLessons.isEmpty()) return

    val queue = model.day.queue
    val foldsDone = queue.done.size > DONE_ROWS
    val moreOpen = viewModel.moreOpen
    val coming = if (next != null && (model.day.lessonsComing || model.day.lessonsToPrepare)) 1 else 0
    val upcoming = queue.after.size + coming + model.day.plusLessons.size
    val more = (upcoming - UPCOMING_ROWS).coerceAtLeast(0)
    val shownAfter = if (moreOpen) queue.after else queue.after.take(UPCOMING_ROWS)
    val showsComing = coming > 0 && (moreOpen || queue.after.size < UPCOMING_ROWS)
    val plusShown =
        (if (moreOpen) model.day.plusLessons.size else (UPCOMING_ROWS - queue.after.size - coming).coerceAtLeast(0))
            .coerceAtMost(model.day.plusLessons.size)
    // The list's last row has no hairline under it, as main's `last:border-b-0`; above "+N more" it keeps one.
    val endsList = more == 0 || moreOpen

    item(key = "queue-top", contentType = "spacer") { Box(Modifier.padding(top = 12.dp)) }

    if (foldsDone) {
        item(key = "fold-done", contentType = "fold") {
            FoldRow(
                label = doneFoldLabel(queue.done),
                done = true,
                open = viewModel.doneOpen,
                minutes = null,
                onToggle = { viewModel.doneOpen = !viewModel.doneOpen },
                modifier = Modifier.pageItem(),
            )
        }
    }

    val rowsShown = (if (!foldsDone || viewModel.doneOpen) queue.done else emptyList()) + queue.before + listOfNotNull(next) + shownAfter

    val beforeNext = next?.let { rowsShown.indexOf(it) - 1 }
    val stepsEnd = endsList && !showsComing && plusShown == 0

    itemsIndexed(rowsShown, key = { _, step -> "step-${step.position}" }, contentType = { _, _ -> "step" }) { index, step ->
        val isNext = step.position == next?.position
        val replay = step.lessonToReplay
        StepRow(
            model = model,
            step = step,
            isNext = isNext,
            opens = replay != null || (next != null && step.canOpen),
            busy = viewModel.pending == TodayTap.Step(step.position) || (isNext && viewModel.pending == TodayTap.Continue),
            openFailed = viewModel.failed == TodayTap.Step(step.position),
            onOpen = { if (replay != null) actions.navigate(AppRoute.Lesson(replay.toString())) else actions.open(step) },
            modifier = Modifier.pageRow(),
            onNavigate = actions.navigate,
            divider = index != beforeNext && !(stepsEnd && index == rowsShown.lastIndex),
        )
    }

    if (showsComing) {
        item(key = "coming", contentType = "coming") {
            ComingLessonsRow(model, viewModel, actions, Modifier.pageRow(), divider = !endsList || plusShown > 0)
        }
    }

    plusLessons(model.day.plusLessons, actions, visible = plusShown, endsList = endsList)

    if (more > 0) {
        item(key = FOLD_MORE, contentType = "fold") {
            FoldRow(
                label =
                    if (moreOpen) {
                        stringResource(
                            R.string.today_show_less,
                        )
                    } else {
                        pluralStringResource(R.plurals.today_more_count, more, more)
                    },
                done = false,
                open = moreOpen,
                minutes =
                    model.day
                        .minutesAfter(queue.before + listOfNotNull(next) + queue.after.take(UPCOMING_ROWS))
                        .takeIf { !moreOpen && queue.after.size + coming > UPCOMING_ROWS },
                onToggle = {
                    if (moreOpen) list.keepFoldInView(hidden = more)
                    viewModel.moreOpen = !moreOpen
                },
                modifier = Modifier.pageItem(),
            )
        }
    }
}

/**
 * The list holds its place by the first row it shows, so folding away the rows on screen would
 * leave it past the list. The fold row stays where the learner tapped it instead.
 */
private fun LazyListState.keepFoldInView(hidden: Int) {
    val fold = layoutInfo.visibleItemsInfo.firstOrNull { it.key == FOLD_MORE } ?: return
    val foldedIndex = fold.index - hidden

    if (firstVisibleItemIndex >= foldedIndex) requestScrollToItem(foldedIndex, -fold.offset)
}

/** Not part of the session: never the next block, no mission mark, and the day's time leaves them out. */
private fun LazyListScope.plusLessons(
    titles: List<String>,
    actions: TodayActionHandlers,
    visible: Int,
    endsList: Boolean,
) {
    val shown = titles.take(visible)
    items(shown.withIndex().toList(), key = { "plus-${it.index}" }, contentType = { "plus" }) { (index, title) ->
        DayQueueRow(
            onClick = { actions.navigate(AppRoute.Subscription) },
            modifier = Modifier.pageRow(),
            divider = !endsList || index != shown.lastIndex,
            leading = { KindMark(LearnKind.Lesson) },
            meta = { PlusMark() },
        ) {
            Text(text = title, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * Holds the place of the day's lessons that aren't written yet: Today reads again until they land
 * while they're outlined, and asks the learner for them while nobody is.
 */
@Composable
private fun ComingLessonsRow(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    modifier: Modifier,
    divider: Boolean,
) {
    DayQueueRow(
        onClick = null,
        modifier = modifier,
        divider = divider,
        leading = { KindMark(LearnKind.Lesson) },
        supporting = { ComingLessonsLine(model, viewModel, actions) },
    ) {
        Text(text = stringResource(R.string.today_coming_title), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ComingLessonsLine(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
) {
    if (!model.day.lessonsToPrepare) {
        Text(
            stringResource(if (model.writingStalled) R.string.today_coming_stalled else R.string.today_coming_writing),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        return
    }

    Column {
        FlowRow(itemVerticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.today_coming_not_written))
            TextButton(onClick = actions.prepare, enabled = viewModel.pending != TodayTap.Prepare) {
                Text(stringResource(R.string.today_get_lessons))
            }
        }
        if (viewModel.failed == TodayTap.Prepare) {
            Text(
                stringResource(R.string.today_save_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

private fun LazyListScope.upNext(
    lessons: List<StudyExtraTimeLessonsInner>,
    pending: TodayTap?,
    failed: Boolean,
    actions: TodayActionHandlers,
) {
    item(key = "up-next-title", contentType = "title") {
        SectionHeader(stringResource(R.string.today_up_next), Modifier.pageItem().padding(top = 24.dp, bottom = 8.dp))
    }

    items(lessons.withIndex().toList(), key = { "up-next-${it.index}" }, contentType = { "up-next" }) { (index, lesson) ->
        val first = index == 0
        DayQueueRow(
            isNext = first,
            busy = first && pending == TodayTap.UpNext,
            waiting = pending != null && pending != TodayTap.UpNext,
            onClick = if (first) actions.upNext else null,
            modifier = Modifier.pageRow(),
            leading = { KindMark(LearnKind.Lesson) },
            supporting = if (first && failed) ({ StepOpenFailed() }) else null,
            meta = { DayMinutes(lesson.minutes) },
        ) {
            Text(text = lesson.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun StepRow(
    model: TodayDayModel,
    step: DayStep,
    isNext: Boolean,
    opens: Boolean,
    busy: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier,
    openFailed: Boolean = false,
    onNavigate: (AppRoute) -> Unit = {},
    divider: Boolean = true,
) {
    DayStepRow(
        model.day,
        step,
        isNext,
        modifier,
        model.today.lessonStatus,
        model.writingStalled,
        onOpen = onOpen.takeIf { opens },
        busy = busy,
        openFailed = openFailed,
        divider = divider,
        testOut =
            if (isNext && step.canTestOut && step.chapterId != null) {
                { TestOutLink(model, requireNotNull(step.chapterId), onNavigate) }
            } else {
                null
            },
    )
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
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
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
            val already = stringResource(R.string.today_already_know_this)
            append(already)
            append(spaceAfterSentence(already))
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

/** A fold's mark slot, so its words start where the rows' do. */
@Composable
private fun RowMark(content: @Composable () -> Unit) {
    Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { content() }
}

/** Only time still ahead says its minutes: a done row's are the plan's estimate. */
@Composable
private fun FoldRow(
    label: String,
    done: Boolean,
    open: Boolean,
    minutes: Double?,
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
        if (minutes != null && minutes > 0) DayMinutes(minutes)
    }
}

/** Skipped steps fold in with the done ones, so the row says which is which. */
@Composable
private fun doneFoldLabel(done: List<DayStep>): String {
    val skipped = done.count { it.status == StudyBlock.Status.SKIPPED }
    val completed = done.size - skipped
    val completedText = pluralStringResource(R.plurals.today_done_count, completed, completed)
    val skippedText = pluralStringResource(R.plurals.today_skipped_count, skipped, skipped)

    return when {
        skipped == 0 -> completedText
        completed == 0 -> skippedText
        else -> completedText + FACT_SEPARATOR + skippedText
    }
}

@Composable
internal fun stepsDone(bar: SessionBar): String {
    val locale = currentLocale()
    return stringResource(
        R.string.today_steps_done,
        formatNumber(bar.completed.toDouble(), locale),
        formatNumber(bar.total.toDouble(), locale),
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
        StudySession.State.DONE -> {
            val studied = day.studiedToday()
            val link =
                if (model.keepLearning) {
                    statusLink(stringResource(R.string.today_see_summary)) {
                        actions.navigate(AppRoute.Session(goalId = (day.goalId ?: model.today.goal.id).toString()))
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

        StudySession.State.WAITING -> {
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

        StudySession.State.PREPARE -> {
            TodayStatusLine(R.drawable.ic_schedule, stringResource(R.string.today_lessons_not_written), null, modifier)
        }

        StudySession.State.REST -> {
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
        StudySession.State.AHEAD -> {
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

        StudySession.State.UNDERWAY -> {
            return
        }
    }
}

private const val DONE_ROWS = 1
private const val FOLD_MORE = "fold-more"
private const val OPEN_BACKLOG_LIMIT = 5
