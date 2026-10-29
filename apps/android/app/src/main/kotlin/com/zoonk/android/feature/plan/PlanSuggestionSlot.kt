package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionContentScope
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionFrame
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamChoice
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.StudyNext
import kotlinx.coroutines.delay

/** One thing to know or decide about the plan, in the order main's slot gives them. */
internal sealed interface SlotItem {
    val key: String

    data object Paused : SlotItem {
        override val key = "paused"
    }

    data class Choice(
        val choice: ExamChoice,
    ) : SlotItem {
        override val key get() = "choice:${choice.group}"
    }

    data class PastDate(
        val lessons: Int,
    ) : SlotItem {
        override val key get() = "pastDate"
    }

    data object FitLessons : SlotItem {
        override val key = "fitLessons"
    }

    data object Coverage : SlotItem {
        override val key = "coverage"
    }

    data object Finished : SlotItem {
        override val key = "finished"
    }

    data class Pace(
        val tooTight: Boolean,
        val text: String,
    ) : SlotItem {
        override val key get() = if (tooTight) "tooTight" else "behind"
    }

    data object FreeWeekOver : SlotItem {
        override val key = "freeWeekOver"
    }
}

/** [finished] once what to study next is known; [fix] is the pace's sentence. */
internal fun slotItems(
    page: PlanPageState,
    fix: PaceFix?,
    finished: Boolean,
): List<SlotItem> {
    val plan = page.plan
    val pace = plan.status?.pace
    val pastDate = pace as? Pace.PastDate
    val open = !plan.access.freeWeekOver && pastDate == null
    val time =
        listOfNotNull(
            SlotItem.FitLessons.takeIf { open && plan.fitOffer != null },
            SlotItem.Coverage.takeIf { open && planCoverage(plan) != null && !timeEnough(plan) },
        )

    return buildList {
        if (page.isPaused) add(SlotItem.Paused)
        plan.examChoices
            .filter { it.subject == null }
            .forEach { add(SlotItem.Choice(it)) }
        pastDate?.let { add(SlotItem.PastDate(it.lessons)) }
        if (finished) {
            addAll(time)
            add(SlotItem.Finished)
        }
        if (pace is Pace.NeedsAdjusting && fix != null) add(SlotItem.Pace(tooTight = true, fix.text))
        if (pace is Pace.Behind && fix != null) add(SlotItem.Pace(tooTight = false, fix.text))
        if (!finished) addAll(time)
        if (plan.access.freeWeekOver) add(SlotItem.FreeWeekOver)
    }
}

/** What a suggestion the learner answered changed, shown with its Undo for a moment; no change when it saved without one. */
internal class SlotResult(
    val item: SlotItem,
    val change: PlanChange?,
)

internal enum class CoverageIntent { Time, Date }

internal enum class DateSearch { Finding, Building, Failed, NoDate }

/**
 * Main's `PlanSuggestionProvider`, kept above the slot: a resized window swaps its line for its
 * panel, and both show this one state.
 */
@Stable
internal class SlotState(
    position: Int = 0,
    dismissed: List<String> = emptyList(),
    intent: CoverageIntent = CoverageIntent.Time,
) {
    var position by mutableIntStateOf(position)

    /** Keys put off with Not now until the Plan is opened again. */
    var dismissed by mutableStateOf(dismissed)
    var result by mutableStateOf<SlotResult?>(null)

    /** The key of the item whose change didn't save. */
    var failed by mutableStateOf<String?>(null)
    var intent by mutableStateOf(intent)
    var dateSearch by mutableStateOf<DateSearch?>(null)

    /** The coverage search the learner waits for; null once they stop. */
    var asking: CoverageIntent? = null

    /** The date search the learner waits for (0 for none), so one put off or superseded shows nothing. */
    var waiting = 0
    var searches = 0

    /** The result shows until it's undone. */
    fun answered(edits: PlanEdits): SlotResult? = result?.takeIf { result -> result.change?.let { edits.changes[it.id]?.undone } != true }

    /** What one item asked, which paging away drops, as main's items keyed by their key do. */
    fun resetItem() {
        failed = null
        intent = CoverageIntent.Time
        dateSearch = null
        asking = null
        waiting = 0
    }
}

/** What the slot reads beside the plan: its own preview, and what to study next once the plan has ended. */
internal class SlotHost(
    val preview: PlanPreviewState = PlanPreviewState.Idle,
    val requestPreview: (List<PlanOp>) -> Unit = {},
    val clearPreview: () -> Unit = {},
    val next: StudyNext? = null,
    val nextLevel: NextLevelStart = NextLevelStart.Idle,
    val onContinue: () -> Unit = {},
)

/** What every item reads and does, as main's `usePlanSuggestionSlot`. */
internal class Slot(
    val page: PlanPageState,
    val edits: PlanEdits,
    val links: PlanLinks,
    val host: SlotHost,
    val state: SlotState,
    val layout: SuggestionLayout,
) {
    val answered: SlotResult? get() = state.answered(edits)

    fun answer(item: SlotItem): SlotResult? = answered?.takeIf { it.item.key == item.key }

    fun move(
        step: Int,
        index: Int,
        count: Int,
    ) {
        leave()
        state.position = (index + step + count) % count
    }

    fun dismiss(item: SlotItem) {
        leave()
        state.dismissed += item.key
    }

    /** Saves [operations] from [item], whose answer then shows with Undo. */
    fun apply(
        item: SlotItem,
        operations: List<PlanOp>,
    ) {
        state.failed = null
        edits.change(PlanPart.Suggestion, operations) { saved ->
            when {
                saved == null -> {
                    state.failed = item.key
                }

                saved.status == PlanChangeResult.Status.APPLIED -> {
                    host.clearPreview()
                    state.result = SlotResult(item, saved.change)
                }
            }
        }
    }

    private fun leave() {
        host.clearPreview()
        state.resetItem()
    }
}

/** The items to page through, without those put off with Not now. */
@Composable
private fun slotItemsLeft(
    page: PlanPageState,
    host: SlotHost,
    state: SlotState,
): List<SlotItem> {
    val fix =
        page.plan.status
            ?.pace
            ?.let { paceFix(it, page.isExam) }
    return slotItems(page, fix, finished = host.next != null).filter { it.key !in state.dismissed }
}

/** Whether the slot shows anything, so a page leaves no room for it when it doesn't. */
@Composable
internal fun hasSlotItem(
    page: PlanPageState,
    edits: PlanEdits,
    host: SlotHost,
    state: SlotState,
): Boolean = state.answered(edits) != null || slotItemsLeft(page, host, state).isNotEmpty()

/**
 * Main's suggestion slot: one item at a time with a pager, as a line on narrow pages and a panel
 * beside the page. An answer that changes the plan shows what it did, with Undo, for a moment.
 */
@Composable
internal fun PlanSuggestionSlot(
    page: PlanPageState,
    edits: PlanEdits,
    links: PlanLinks,
    resume: Resume,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
    onAdjust: (PlanSection?) -> Unit,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
    host: SlotHost = SlotHost(),
    state: SlotState = remember { SlotState() },
) {
    val items = slotItemsLeft(page, host, state)
    val slot = Slot(page, edits, links, host, state, layout)
    val answered = slot.answered
    val index = state.position.coerceIn(0, (items.size - 1).coerceAtLeast(0))
    val item = answered?.item ?: items.getOrNull(index) ?: return
    val timeout =
        LocalAccessibilityManager.current?.calculateRecommendedTimeoutMillis(RESULT_MILLIS, containsControls = true) ?: RESULT_MILLIS

    LaunchedEffect(answered) {
        if (answered != null) {
            delay(timeout)
            state.result = null
        }
    }

    val pager: (@Composable (Modifier) -> Unit)? =
        if (items.size > 1) {
            { SlotPager(index, items.size, hidden = answered != null, it) { step -> slot.move(step, index, items.size) } }
        } else {
            null
        }
    val suggestion: @Composable () -> Unit = {
        key(item.key) {
            when (item) {
                SlotItem.Paused -> {
                    PausedSuggestion(page, layout, resume, onSetStatus)
                }

                is SlotItem.Choice -> {
                    val change = slot.answer(item)?.change
                    ExamChoiceSuggestion(
                        choice = item.choice,
                        layout = layout,
                        failed = edits.hasFailed(PlanPart.ExamChoices),
                        answer = change?.let { planChangeSentence(it) },
                        undoFailed = change?.let { edits.changes[it.id]?.undoFailed } == true,
                        onChoose = { subject ->
                            edits.chooseExamOption(item.choice.group, subject) { answer ->
                                answer?.change?.takeIf { answer.status == PlanChangeResult.Status.APPLIED }?.let {
                                    state.result = SlotResult(item, it)
                                }
                            }
                        },
                        undo = { change?.takeIf { it.canUndo }?.let { SlotUndo(it, edits) } },
                    )
                }

                is SlotItem.PastDate -> {
                    PastDateSuggestion(item, slot, onAdjust)
                }

                SlotItem.FitLessons -> {
                    FitLessonsSuggestion(slot)
                }

                SlotItem.Coverage -> {
                    CoverageSuggestion(slot)
                }

                SlotItem.Finished -> {
                    host.next?.let { StudyNextSuggestion(it, slot) }
                }

                is SlotItem.Pace -> {
                    PaceSuggestion(item, layout, links, onAdjust)
                }

                SlotItem.FreeWeekOver -> {
                    FreeWeekSuggestion(layout, links)
                }
            }
        }
    }

    Column(modifier.semantics { isTraversalGroup = true }) {
        if (layout == SuggestionLayout.Panel) {
            // The panel's pager heads it, so paging never moves it under the finger.
            SuggestionFrame(head = pager?.let { { it(Modifier.padding(top = 4.dp, end = 4.dp)) } }, content = suggestion)
        } else {
            suggestion()
            pager?.invoke(Modifier)
        }
    }
}

/** [hidden] while a result shows: it keeps its place, so the result doesn't move. */
@Composable
private fun SlotPager(
    index: Int,
    count: Int,
    hidden: Boolean,
    modifier: Modifier,
    onMove: (Int) -> Unit,
) {
    val locale = currentLocale()
    Row(
        modifier = modifier.fillMaxWidth().then(if (hidden) Modifier.alpha(0f).clearAndSetSemantics {} else Modifier),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = { onMove(-1) }, enabled = !hidden) {
            Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = stringResource(R.string.plan_suggestion_previous))
        }
        Text(
            text =
                stringResource(
                    R.string.plan_suggestion_position,
                    formatNumber((index + 1).toDouble(), locale),
                    formatNumber(count.toDouble(), locale),
                ),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        IconButton(onClick = { onMove(1) }, enabled = !hidden) {
            Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = stringResource(R.string.plan_suggestion_next))
        }
    }
}

@Composable
private fun SlotUndo(
    change: PlanChange,
    edits: PlanEdits,
) {
    SuggestionAction(
        text = stringResource(R.string.plan_undo),
        onClick = { edits.undo(change) },
        enabled = edits.changes[change.id]?.undoing != true,
        secondary = true,
    )
}

/** Main's `PlanChangeSuggestion`: a change to offer, which says what it did, with Undo, once applied. */
@Composable
internal fun PlanChangeSuggestion(
    item: SlotItem,
    title: String,
    slot: Slot,
    mark: SuggestionMark = SuggestionMark.New,
    content: @Composable SuggestionContentScope.() -> Unit,
) {
    val answer = slot.answer(item)
    val change = answer?.change
    val result = answer?.let { change?.let { planChangeSentence(it) } ?: stringResource(R.string.plan_updated_sentence) }
    val undoFailed = change?.let { slot.edits.changes[it.id]?.undoFailed } == true
    val undo = @Composable { if (change?.canUndo == true) SlotUndo(change, slot.edits) }

    Suggestion(
        label = stringResource(R.string.plan_suggestion),
        summary = if (undoFailed) stringResource(R.string.suggestion_save_failed) else result ?: title,
        layout = slot.layout,
        mark = if (answer != null) SuggestionMark.Done else mark,
        answered = answer != null,
        lineAction = if (answer != null) undo else ({ SuggestionOpen() }),
    ) {
        if (result != null) {
            SuggestionHeader(stringResource(R.string.plan_updated))
            SuggestionResult(result)
            SuggestionActions(undo)
            if (undoFailed) SuggestionSaveError()
            return@Suggestion
        }
        SuggestionHeader(title)
        content()
        if (slot.state.failed == item.key) SuggestionSaveError()
    }
}

@Composable
private fun PausedSuggestion(
    page: PlanPageState,
    layout: SuggestionLayout,
    resume: Resume,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
) {
    val title = stringResource(R.string.plan_goal_paused, page.goal.title)
    val resumeAction =
        @Composable {
            SuggestionAction(
                text = stringResource(R.string.plan_resume),
                onClick = { onSetStatus(GoalUpdateInput.Status.ACTIVE) },
                enabled = resume != Resume.Pending,
            )
        }

    Suggestion(
        label = title,
        summary = title,
        layout = layout,
        mark = SuggestionMark.Symbol(R.drawable.ic_pause),
        lineAction = if (resume == Resume.Confirm) ({ SuggestionOpen() }) else resumeAction,
    ) {
        SuggestionHeader(title)
        SuggestionDescription(
            stringResource(if (resume == Resume.Confirm) R.string.plan_resume_effect else R.string.plan_nothing_planned_until_resume),
        )
        SuggestionActions { resumeAction() }
    }
}

@Composable
private fun PaceSuggestion(
    item: SlotItem.Pace,
    layout: SuggestionLayout,
    links: PlanLinks,
    onAdjust: (PlanSection?) -> Unit,
) {
    val title = stringResource(if (item.tooTight) R.string.plan_no_longer_fits else R.string.plan_catch_up)

    Suggestion(
        label = title,
        summary = item.text,
        layout = layout,
        mark = SuggestionMark.Symbol(R.drawable.ic_calendar_clock),
        lineAction =
            if (item.tooTight) {
                { SuggestionAction(stringResource(R.string.plan_adjust), onClick = { onAdjust(null) }) }
            } else {
                { SuggestionOpen() }
            },
    ) {
        SuggestionHeader(title)
        if (item.tooTight) {
            SuggestionActions {
                SuggestionAction(stringResource(R.string.plan_adjust_plan), onClick = {
                    close()
                    onAdjust(null)
                })
            }
        } else {
            SuggestionDescription(item.text)
            SuggestionActions {
                SuggestionAction(stringResource(R.string.plan_go_to_today), onClick = {
                    close()
                    links.today()
                })
            }
        }
    }
}

@Composable
private fun FreeWeekSuggestion(
    layout: SuggestionLayout,
    links: PlanLinks,
) {
    val title = stringResource(R.string.subscription_free_week_over_title)

    Suggestion(
        label = title,
        summary = title,
        layout = layout,
        mark = SuggestionMark.Symbol(R.drawable.ic_auto_awesome),
        lineAction = { SuggestionAction(stringResource(R.string.subscription_see_plus), onClick = links::plus) },
    ) {
        SuggestionHeader(title)
        SuggestionDescription(stringResource(R.string.subscription_free_week_over_description))
        SuggestionActions {
            SuggestionAction(stringResource(R.string.subscription_see_plus), onClick = {
                close()
                links.plus()
            })
        }
    }
}

private const val RESULT_MILLIS = 8_000L
