package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.zoonk.android.R
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** The change a found time offers, as main's `useAnswerOffer` picks it. */
internal sealed interface CoverageChange {
    val operations: List<PlanOp>

    data class Date(
        val date: LocalDate,
    ) : CoverageChange {
        override val operations get() = listOf(PlanOp.TargetDate(date))
    }

    data class Time(
        val minutes: Int,
    ) : CoverageChange {
        override val operations get() = listOf(PlanOp.DailyMinutes(minutes))
    }
}

/** A goal moves its date when asked to, or when no time covers everything; an exam's date never moves. */
internal fun coverageChange(
    isExam: Boolean,
    intent: CoverageIntent,
    time: PlanTimeToCover,
): CoverageChange? {
    val answer = time.answer()
    val fitting = time.fittingDate?.toJavaLocalDate()
    if (!isExam && fitting != null && (intent == CoverageIntent.Date || answer !is TimeToCoverAnswer.Covers)) {
        return CoverageChange.Date(fitting)
    }
    if (intent == CoverageIntent.Date || answer !is TimeToCoverAnswer.Covers) return null
    return CoverageChange.Time(answer.minutes)
}

private class CoverageOffer(
    val description: List<String>,
    val operations: List<PlanOp>,
    val title: String,
)

/** Main's `useCourseOffer`: an exam studying everything offers to stop once its date comes. */
@Composable
private fun courseOffer(page: PlanPageState): CoverageOffer? {
    val course = fullCourse(page)?.takeIf { it.on } ?: return null
    return CoverageOffer(
        description = listOf(stringResource(R.string.plan_most_asked_first_until_exam)),
        operations = course.operations(false),
        title = finishText(course, course.endDate, page) ?: stringResource(R.string.plan_study_everything_after_exam),
    )
}

@Composable
private fun answerOffer(
    page: PlanPageState,
    covered: String,
    intent: CoverageIntent,
    time: PlanTimeToCover,
): CoverageOffer? {
    val locale = currentLocale()
    return when (val change = coverageChange(page.isExam, intent, time)) {
        null -> {
            null
        }

        is CoverageChange.Date -> {
            val target = time.targetDate?.takeIf { time.answer() is TimeToCoverAnswer.None }
            val none = target?.let { noTimeCoversText(it.toJavaLocalDate(), time.targetDateNamedMonth, page.today) }
            CoverageOffer(
                description = listOfNotNull(covered, none.takeIf { intent == CoverageIntent.Time }),
                operations = change.operations,
                title =
                    stringResource(
                        R.string.plan_time_covers_everything_by,
                        formatDate(change.date, locale, DateStyle.Long, page.today),
                    ),
            )
        }

        is CoverageChange.Time -> {
            CoverageOffer(
                description = listOf(covered),
                operations = change.operations,
                title = stringResource(R.string.plan_time_covers_everything_in_depth, formatMinutes(change.minutes, locale)),
            )
        }
    }
}

/**
 * Main's `CoverageSuggestion`: what the learner's time covers, and the time or date that covers
 * everything, found only from their tap since finding it plans the goal at each time.
 */
@Composable
internal fun CoverageSuggestion(slot: Slot) {
    val page = slot.page
    val plan = page.plan
    val edits = slot.edits
    val state = slot.state
    val coverage = planCoverage(plan)
    val covered = coverage?.let { coveredText(plan, it) }.orEmpty()
    val search = edits.timeToCover.forPlan(plan)
    val found = (search as? TimeToCoverState.Answered)?.time
    val course = fullCourse(page)
    val courseOffer = courseOffer(page)
    val offer = courseOffer ?: found?.takeIf { coverage != null }?.let { answerOffer(page, covered, state.intent, it) }
    val title = offer?.title ?: covered
    val isGoal = !page.isExam
    val pending = search is TimeToCoverState.Pending
    val retry = search is TimeToCoverState.Failed || search is TimeToCoverState.Building
    val dateless = isGoal && found != null && found.fittingDate == null
    val noDate = dateless && state.intent == CoverageIntent.Date
    val moveDate = isGoal && courseOffer == null && !dateless && offer?.operations?.firstOrNull() !is PlanOp.TargetDate
    val studiesEverything = !isGoal && courseOffer == null && found?.answer() is TimeToCoverAnswer.None && course != null
    val failed = stringResource(if (state.intent == CoverageIntent.Date) R.string.plan_couldnt_check_changes else R.string.plan_find_failed)
    val none =
        found?.targetDate?.takeIf { offer == null && !noDate }?.let {
            noTimeCoversText(it.toJavaLocalDate(), found.targetDateNamedMonth, page.today)
        }
    val status =
        when {
            retry -> if (search is TimeToCoverState.Building) stringResource(R.string.plan_find_building) else failed
            noDate -> stringResource(R.string.plan_find_no_date)
            else -> none
        }
    val preview = slot.host.preview.of(offer?.operations.orEmpty(), plan)

    /** [focus] moves to the suggestion once the search answers, as the control that asked gives way. */
    fun ask(
        next: CoverageIntent,
        focus: () -> Unit,
    ) {
        state.asking = next
        state.intent = next
        slot.host.clearPreview()
        edits.findTimeToCover(plan) { outcome ->
            if (state.asking == next) focus()
            val time = (outcome as? TimeToCoverOutcome.Answered)?.time ?: return@findTimeToCover
            val change = coverageChange(page.isExam, next, time) ?: return@findTimeToCover
            if (coverage != null && state.asking == next) slot.host.requestPreview(change.operations)
        }
    }

    fun stopAsking() {
        state.asking = null
        state.intent = CoverageIntent.Time
    }

    PlanChangeSuggestion(SlotItem.Coverage, title, slot) {
        offer?.description?.filter { it != title }?.forEach { SuggestionDescription(it) }
        status?.let { StatusDescription(it) }

        when {
            preview != PlanPreviewState.Idle && offer != null -> {
                PlanPreviewResult(
                    state = preview,
                    onApply = { slot.applyPreview(SlotItem.Coverage, preview) },
                    onRetry = { slot.host.requestPreview(offer.operations) },
                    onDismiss = slot.host.clearPreview,
                    goalDate = goalDateMove(offer.operations, plan.schedule.targetDate?.toJavaLocalDate()),
                    pending = edits.isPending(PlanPart.Suggestion),
                )
            }

            pending && state.intent == CoverageIntent.Date -> {
                CheckingChange(::stopAsking)
            }

            else -> {
                SuggestionActions {
                    offer?.let {
                        SuggestionAction(
                            stringResource(R.string.plan_preview),
                            onClick = { slot.host.requestPreview(it.operations) },
                        )
                    }
                    if (offer == null && found == null) {
                        FindAction(pending, retry) { ask(if (retry) state.intent else CoverageIntent.Time, focus) }
                    }
                    if (studiesEverything) {
                        SuggestionAction(stringResource(R.string.plan_study_everything_after_exam), onClick = {
                            close()
                            edits.studyEverything()
                        })
                    }
                    if (coverage != null) {
                        OtherOptions { done ->
                            if (moveDate) Option(stringResource(R.string.plan_move_date), done) { ask(CoverageIntent.Date, focus) }
                            if (canChooseFocus(plan)) {
                                Option(stringResource(R.string.plan_choose_focus), done) {
                                    close()
                                    edits.chooseFocus()
                                }
                            }
                            if (course != null && !course.on && !studiesEverything) {
                                val text = if (course.isExam) R.string.plan_study_everything_after_exam else R.string.plan_study_everything
                                Option(stringResource(text), done) {
                                    close()
                                    edits.studyEverything()
                                }
                            }
                            Option(stringResource(R.string.plan_not_now), done) { slot.dismiss(SlotItem.Coverage) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FindAction(
    pending: Boolean,
    retry: Boolean,
    onFind: () -> Unit,
) {
    val finding = stringResource(R.string.plan_finding)
    SuggestionAction(
        onClick = onFind,
        modifier = if (pending) Modifier.semantics { stateDescription = finding } else Modifier,
        enabled = !pending,
    ) {
        PendingLabel(pending, stringResource(if (retry) R.string.plan_try_again else R.string.plan_find))
    }
}

/** Main's `FitLessonsSuggestion`: the lessons the learner's own time fits that the plan doesn't hold. */
@Composable
internal fun FitLessonsSuggestion(slot: Slot) {
    val page = slot.page
    val offer = page.plan.fitOffer
    val target = page.plan.schedule.targetDate
    val lessons =
        offer
            ?.effect
            ?.lessonsAdded
            ?.toInt() ?: 0
    val title =
        if (offer?.fits == true && target != null) {
            stringResource(
                R.string.plan_time_covers_everything_by,
                goalDate(target.toJavaLocalDate(), page.plan.schedule.targetDateNamedMonth, page.today),
            )
        } else {
            pluralStringResource(R.plurals.plan_more_lessons_fit, lessons, lessons)
        }

    PlanChangeSuggestion(SlotItem.FitLessons, title, slot) {
        offer?.let { topicsMoved(it.effect, named = NAMED_TOPICS) }?.let { SuggestionDescription(it) }
        offer?.let { PlanEffectDiff(it.effect) }
        SuggestionActions {
            if (offer != null && offer.canApply) {
                SuggestionAction(
                    stringResource(R.string.plan_apply),
                    onClick = { slot.apply(SlotItem.FitLessons, offer.operations.map { it.op }) },
                    enabled = !slot.edits.isPending(PlanPart.Suggestion),
                )
            }
            SuggestionAction(stringResource(R.string.plan_not_now), onClick = { slot.dismiss(SlotItem.FitLessons) }, secondary = true)
        }
    }
}

private const val NAMED_TOPICS = 2

private val STUDY_AFTER_EXAM = listOf(PlanOp.FullCourse(true))

/**
 * Main's `PastDateSuggestion`. A goal's new date is found only when the learner taps Preview:
 * finding it plans the goal at each candidate date.
 */
@Composable
internal fun PastDateSuggestion(
    item: SlotItem.PastDate,
    slot: Slot,
    onAdjust: (PlanSection?) -> Unit,
) {
    val page = slot.page
    val state = slot.state
    val title =
        pluralStringResource(
            if (page.isExam) R.plurals.plan_past_date_exam_title else R.plurals.plan_past_date_goal_title,
            item.lessons,
            item.lessons,
        )
    val preview = (slot.host.preview as? PlanPreviewState.Asked)?.takeIf { it.plan == page.plan }
    val search = state.dateSearch
    val retry = search == DateSearch.Failed || search == DateSearch.Building

    fun showChange() {
        if (page.isExam) {
            slot.host.requestPreview(STUDY_AFTER_EXAM)
            return
        }
        val request = ++state.searches
        state.waiting = request
        state.dateSearch = DateSearch.Finding
        slot.edits.findTimeToCover(page.plan) { found ->
            if (state.waiting != request) return@findTimeToCover
            state.waiting = 0
            val date = (found as? TimeToCoverOutcome.Answered)?.time?.fittingDate?.toJavaLocalDate()
            date?.let { slot.host.requestPreview(CoverageChange.Date(it).operations) }
            state.dateSearch =
                when (found) {
                    is TimeToCoverOutcome.Answered -> if (date == null) DateSearch.NoDate else null
                    TimeToCoverOutcome.Building -> DateSearch.Building
                    TimeToCoverOutcome.Failed -> DateSearch.Failed
                    TimeToCoverOutcome.Stale -> null
                }
        }
    }

    fun stopWaiting() {
        state.waiting = 0
        state.dateSearch = null
    }

    PlanChangeSuggestion(item, title, slot, mark = SuggestionMark.Symbol(R.drawable.ic_calendar_clock)) {
        val adjust = {
            close()
            onAdjust(PlanSection.Date)
        }

        when {
            preview != null -> {
                PlanPreviewResult(
                    state = preview,
                    onApply = { slot.applyPreview(item, preview) },
                    onRetry = { slot.host.requestPreview(preview.operations) },
                    onDismiss = slot.host.clearPreview,
                    goalDate =
                        goalDateMove(
                            preview.operations,
                            page.plan.schedule.targetDate
                                ?.toJavaLocalDate(),
                        ),
                    pending = slot.edits.isPending(PlanPart.Suggestion),
                )
            }

            search == DateSearch.Finding -> {
                CheckingChange(::stopWaiting)
            }

            search == DateSearch.NoDate -> {
                StatusDescription(stringResource(R.string.plan_find_no_date))
                SuggestionActions {
                    SuggestionAction(stringResource(R.string.plan_adjust_plan), onClick = adjust)
                    SuggestionAction(stringResource(R.string.plan_not_now), onClick = { slot.dismiss(item) }, secondary = true)
                }
            }

            else -> {
                when {
                    search == DateSearch.Building -> StatusDescription(stringResource(R.string.plan_find_building))
                    retry -> StatusDescription(stringResource(R.string.plan_couldnt_check_changes))
                    page.isExam -> SuggestionDescription(stringResource(R.string.plan_study_everything_exam_description))
                    else -> SuggestionDescription(stringResource(R.string.plan_move_date_covers_whats_left))
                }
                SuggestionActions {
                    SuggestionAction(stringResource(if (retry) R.string.plan_try_again else R.string.plan_preview), onClick = ::showChange)
                    OtherOptions { done ->
                        Option(stringResource(R.string.plan_adjust_plan), done, adjust)
                        Option(stringResource(R.string.plan_not_now), done) { slot.dismiss(item) }
                    }
                }
            }
        }
    }
}

/** Main's `useApplyPreview`: a preview is applied only once it shows the diff it makes. */
private fun Slot.applyPreview(
    item: SlotItem,
    preview: PlanPreviewState,
) {
    val ready = (preview as? PlanPreviewState.Ready)?.takeIf { !it.preview.unchanged && it.preview.effect != null } ?: return
    apply(item, ready.operations)
}

/** Main's `OtherOptions` menu; each option closes it with [done] before acting. */
@Composable
private fun OtherOptions(options: @Composable (done: () -> Unit) -> Unit) {
    var open by remember { mutableStateOf(false) }

    Box {
        SuggestionAction(
            onClick = { open = true },
            modifier = Modifier.semantics { role = Role.DropdownList },
            secondary = true,
        ) {
            Text(stringResource(R.string.plan_other_options))
            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            Icon(painterResource(R.drawable.ic_expand_more), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) { options { open = false } }
    }
}

@Composable
private fun Option(
    text: String,
    done: () -> Unit,
    onClick: () -> Unit,
) {
    DropdownMenuItem(text = { Text(text) }, onClick = {
        done()
        onClick()
    })
}
