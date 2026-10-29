package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamChoice
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
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

@Composable
internal fun slotItems(page: PlanPageState): List<SlotItem> {
    val pace = page.plan.status?.pace
    val fix = pace?.let { paceFix(it, page.isExam) }
    return buildList {
        if (page.isPaused) add(SlotItem.Paused)
        page.plan.examChoices
            .filter { it.subject == null }
            .forEach { add(SlotItem.Choice(it)) }
        if (pace is Pace.NeedsAdjusting && fix != null) add(SlotItem.Pace(tooTight = true, fix.text))
        if (pace is Pace.Behind && fix != null) add(SlotItem.Pace(tooTight = false, fix.text))
        if (page.plan.access.freeWeekOver) add(SlotItem.FreeWeekOver)
    }
}

/** What a suggestion the learner answered changed, shown with its Undo for a moment. */
private class SlotResult(
    val item: SlotItem,
    val change: PlanChange,
)

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
    onAdjust: () -> Unit,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
) {
    val items = slotItems(page)
    var position by rememberSaveable { mutableIntStateOf(0) }
    var result by remember { mutableStateOf<SlotResult?>(null) }
    val answered = result?.takeIf { edits.changes[it.change.id]?.undone != true }
    val index = position.coerceIn(0, (items.size - 1).coerceAtLeast(0))
    val item = answered?.item ?: items.getOrNull(index) ?: return
    val timeout =
        LocalAccessibilityManager.current?.calculateRecommendedTimeoutMillis(RESULT_MILLIS, containsControls = true) ?: RESULT_MILLIS

    LaunchedEffect(answered) {
        if (answered != null) {
            delay(timeout)
            result = null
        }
    }

    fun move(step: Int) {
        position = (index + step + items.size) % items.size
    }

    val pager = @Composable {
        if (answered == null && items.size > 1) SlotPager(index, items.size, ::move)
    }

    Column(modifier.semantics { isTraversalGroup = true }) {
        if (layout == SuggestionLayout.Panel) pager()
        key(item.key) {
            when (item) {
                SlotItem.Paused -> {
                    PausedSuggestion(page, layout, resume, onSetStatus)
                }

                is SlotItem.Choice -> {
                    val change = answered?.change
                    ExamChoiceSuggestion(
                        choice = item.choice,
                        layout = layout,
                        failed = edits.hasFailed(PlanPart.ExamChoices),
                        answer = change?.let { planChangeSentence(it) },
                        onChoose = { subject ->
                            edits.chooseExamOption(item.choice.group, subject) { answer ->
                                answer?.change?.takeIf { answer.status == PlanChangeResult.Status.APPLIED }?.let {
                                    result =
                                        SlotResult(item, it)
                                }
                            }
                        },
                        undo = { change?.takeIf { it.canUndo }?.let { SlotUndo(it, edits) } },
                    )
                }

                is SlotItem.Pace -> {
                    PaceSuggestion(item, layout, links, onAdjust)
                }

                SlotItem.FreeWeekOver -> {
                    FreeWeekSuggestion(layout, links)
                }
            }
        }
        if (layout == SuggestionLayout.Line) pager()
    }
}

@Composable
private fun SlotPager(
    index: Int,
    count: Int,
    onMove: (Int) -> Unit,
) {
    val locale = currentLocale()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onMove(-1) }) {
            Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = stringResource(R.string.plan_suggestion_previous))
        }
        Text(
            text =
                stringResource(
                    R.string.plan_suggestion_position,
                    formatNumber((index + 1).toDouble(), locale),
                    formatNumber(count.toDouble(), locale),
                ),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        IconButton(onClick = { onMove(1) }) {
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
    onAdjust: () -> Unit,
) {
    val title = stringResource(if (item.tooTight) R.string.plan_no_longer_fits else R.string.plan_catch_up)

    Suggestion(
        label = title,
        summary = item.text,
        layout = layout,
        mark = SuggestionMark.Symbol(R.drawable.ic_calendar_clock),
        lineAction =
            if (item.tooTight) {
                { SuggestionAction(stringResource(R.string.plan_adjust), onClick = onAdjust) }
            } else {
                { SuggestionOpen() }
            },
    ) {
        SuggestionHeader(title)
        if (item.tooTight) {
            SuggestionActions { SuggestionAction(stringResource(R.string.plan_adjust_plan), onClick = onAdjust) }
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
    val title = stringResource(R.string.plan_free_week_over_title)

    Suggestion(
        label = title,
        summary = title,
        layout = layout,
        mark = SuggestionMark.Symbol(R.drawable.ic_auto_awesome),
        lineAction = { SuggestionAction(stringResource(R.string.plan_see_plus), onClick = links::plus) },
    ) {
        SuggestionHeader(title)
        SuggestionDescription(stringResource(R.string.plan_free_week_over_body))
        SuggestionActions {
            SuggestionAction(stringResource(R.string.plan_see_plus), onClick = {
                close()
                links.plus()
            })
        }
    }
}

private const val RESULT_MILLIS = 8_000L
