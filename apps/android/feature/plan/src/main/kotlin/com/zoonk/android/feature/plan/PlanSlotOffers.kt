package com.zoonk.android.feature.plan

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.zoonk.android.R
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionMenu
import com.zoonk.android.ui.components.SuggestionMenuItem
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.PlanSuggestedTime
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.toJavaLocalDate

/** What the card offers: a change, its title and the line under it. */
private class CoverageOffer(
    val description: String? = null,
    val operations: List<PlanOp>,
    val title: String,
)

/** Main's `useSuggestedTimeOffer`: the time the plan suggests, its title the time, its line why. */
@Composable
private fun suggestedTimeOffer(
    page: PlanPageState,
    suggested: PlanSuggestedTime,
): CoverageOffer {
    val schedule = page.plan.schedule
    val target = schedule.targetDate
    val line =
        if (suggested.kind == PlanSuggestedTime.Kind.EVERYTHING && target != null) {
            enoughBy(page, GoalDate(target, schedule.targetDateNamedMonth, schedule.targetDateEstimated))
        } else {
            startsWithMost(page.isExam)
        }
    val minutes = suggested.minutes.toInt()
    return CoverageOffer(
        description = line,
        operations = listOf(PlanOp.DailyMinutes(minutes)),
        title = stringResource(R.string.plan_time_suggest_title, formatMinutes(minutes, currentLocale())),
    )
}

/** The suggested time is enough to cover everything by the goal's date. */
@Composable
private fun enoughBy(
    page: PlanPageState,
    date: GoalDate,
): String {
    val shown = goalDateText(date, page.today)
    val words =
        when {
            page.subjectsTakenOut && date.namedMonth -> R.string.plan_time_enough_in_plan_month
            page.subjectsTakenOut -> R.string.plan_time_enough_in_plan
            page.isExam && date.namedMonth -> R.string.plan_time_enough_exam_month
            page.isExam -> R.string.plan_time_enough_exam
            date.namedMonth -> R.string.plan_time_enough_goal_month
            else -> R.string.plan_time_enough_goal
        }
    return stringResource(words, shown)
}

/** Main's `useDateOffer`: a goal that isn't an exam can move its date to where its own time covers everything. */
@Composable
private fun dateOffer(
    page: PlanPageState,
    time: PlanTimeToCover,
): CoverageOffer? {
    val fitting = time.fittingDate?.toJavaLocalDate()?.takeIf { !page.isExam } ?: return null
    val words = if (page.subjectsTakenOut) R.string.plan_time_covers_everything_in_plan_by else R.string.plan_time_covers_everything_by
    return CoverageOffer(
        operations = listOf(PlanOp.TargetDate(fitting)),
        title = stringResource(words, formatDate(fitting, currentLocale(), DateStyle.Long, page.today)),
    )
}

/**
 * Main's `CoverageSuggestion`: the time the plan suggests, shown only while the learner's own time
 * is below it. Its time previews at once; only moving the date is asked for, since finding one plans
 * the goal many times.
 */
@Composable
internal fun CoverageSuggestion(slot: Slot) {
    val suggested = slot.page.plan.suggestedTime
    if (suggested == null) {
        // Once the time is applied nothing is suggested, but the card still says so, with its Undo.
        PlanChangeSuggestion(SlotItem.Coverage, "", slot) {}
        return
    }
    SuggestedTimeCard(slot, suggested)
}

@Composable
private fun SuggestedTimeCard(
    slot: Slot,
    suggested: PlanSuggestedTime,
) {
    val page = slot.page
    val plan = page.plan
    val edits = slot.edits
    val state = slot.state
    val search = edits.timeToCover.forPlan(plan)
    val found = (search as? TimeToCoverState.Answered)?.time
    val asked = state.intent == CoverageIntent.Date
    val askedOffer = found?.takeIf { asked }?.let { dateOffer(page, it) }
    val retry = asked && (search is TimeToCoverState.Failed || search is TimeToCoverState.Building)
    val pending = asked && search is TimeToCoverState.Pending
    val shown = askedOffer ?: suggestedTimeOffer(page, suggested)
    val offer = shown.takeIf { !retry && !pending }
    val dateless = found != null && found.fittingDate == null
    val course = fullCourse(page)
    val status =
        when {
            retry && search is TimeToCoverState.Building -> stringResource(R.string.plan_find_building)
            retry -> stringResource(R.string.plan_couldnt_check_changes)
            asked && found != null && askedOffer == null -> stringResource(R.string.plan_find_no_date)
            else -> null
        }
    val preview = slot.host.preview.of(offer?.operations.orEmpty(), plan)

    fun askDate() {
        state.asking = CoverageIntent.Date
        state.intent = CoverageIntent.Date
        slot.host.clearPreview()
        edits.findTimeToCover(plan, TimeAsker.Coverage(CoverageIntent.Date))
    }

    fun stopAsking() {
        state.asking = null
        state.intent = CoverageIntent.Time
    }

    PlanChangeSuggestion(SlotItem.Coverage, shown.title, slot) {
        // The card asks: paging away drops what the search owes it, so coming back only shows what was found.
        VisitOf(edits.outcomes.suggestion)
        // Focus moves to the suggestion once the search answers, as the control that asked gives way. What's kept is
        // the answer for the plan shown now ([found]), never the date an older plan's search carried.
        ActOn(edits.outcomes.coverageFound) { (next, _) ->
            if (state.asking != next) return@ActOn
            focus()
            val date = found?.fittingDate?.toJavaLocalDate()?.takeIf { !page.isExam } ?: return@ActOn
            slot.host.requestPreview(listOf(PlanOp.TargetDate(date)))
        }
        shown.description?.let { SuggestionDescription(it) }
        status?.let { StatusDescription(it) }

        when {
            preview != PlanPreviewState.Idle && offer != null -> {
                PlanPreviewResult(
                    dateKind = page.dateKind,
                    state = preview,
                    onApply = { slot.applyPreview(SlotItem.Coverage, preview) },
                    onRetry = { slot.host.requestPreview(offer.operations) },
                    onDismiss = slot.host.clearPreview,
                    goalDate = goalDateMove(offer.operations, plan.schedule.targetDate?.toJavaLocalDate()),
                    pending = edits.isPending(PlanPart.Suggestion),
                )
            }

            pending -> {
                CheckingChange(::stopAsking)
            }

            else -> {
                SuggestionActions {
                    if (retry) {
                        SuggestionAction(stringResource(R.string.plan_try_again), onClick = ::askDate)
                    } else {
                        offer?.let {
                            SuggestionAction(
                                stringResource(R.string.plan_see_changes),
                                onClick = { slot.host.requestPreview(it.operations) },
                            )
                        }
                    }
                    if (focusTestOffer(plan) != null) {
                        SuggestionAction(stringResource(R.string.focustest_take_test), onClick = {
                            close()
                            slot.links.focusTest()
                        }, secondary = true)
                        Text(
                            stringResource(R.string.focustest_suggestion_line),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    SuggestionMenu { done ->
                        if (!page.isExam && !dateless && !asked) {
                            SuggestionMenuItem(stringResource(moveDateLabel(page)), done, ::askDate)
                        }
                        if (canChooseFocus(plan)) {
                            SuggestionMenuItem(stringResource(R.string.plan_choose_focus), done) {
                                close()
                                edits.chooseFocus()
                            }
                        }
                        if (course != null && !course.on) {
                            val text = if (course.isExam) R.string.plan_study_everything_after_exam else R.string.plan_study_everything
                            SuggestionMenuItem(stringResource(text), done) {
                                close()
                                edits.studyEverything()
                            }
                        }
                        SuggestionMenuItem(stringResource(R.string.plan_not_now), done) { slot.dismiss(SlotItem.Coverage) }
                    }
                }
            }
        }
    }
}

/** Main's `FitLessonsSuggestion`: the lessons the learner's own time fits that the plan doesn't hold. */
@Composable
internal fun FitLessonsSuggestion(
    item: SlotItem.FitLessons,
    slot: Slot,
) {
    val page = slot.page
    val offer = item.offer
    val preview = slot.host.preview.of(offer.operations.map { it.op }, page.plan)
    val today = (preview as? PlanPreviewState.Ready)?.preview?.effect
    val lessons = (today ?: offer.effect).lessonsAdded.toInt()
    val title = pluralStringResource(R.plurals.plan_more_lessons_fit, lessons, lessons)

    val pending = slot.edits.isPending(PlanPart.Suggestion)
    val checking = preview is PlanPreviewState.Loading
    val add = { slot.host.addFitOffer(offer) }
    val checkingWords = stringResource(R.string.plan_checking_changes)
    val room = remember(offer) { HeldRoom() }

    PlanChangeSuggestion(item, title, slot) {
        // The card asks: its check adds only while the card shows, so one paged away adds nothing.
        VisitOf(slot.edits.outcomes.suggestion)
        // While it checks, the card stays as it was with its Add busy: the same numbers add from there. In the room a
        // check's answer takes, so its buttons stay put when the answer is a failure.
        if (preview == PlanPreviewState.Idle || checking) {
            EffectRoom(FIT_ROOM_LINES, room) { PlanEffectDiff(offer.effect, dateKind = page.dateKind, said = EffectSaid.LessonsAdded) }
            SuggestionActions {
                SuggestionAction(
                    onClick = add,
                    modifier = if (checking) Modifier.semantics { stateDescription = checkingWords } else Modifier,
                    busy = pending || checking,
                ) { Text(stringResource(R.string.plan_add_to_my_plan)) }
                SuggestionAction(stringResource(R.string.plan_not_now), onClick = { slot.dismiss(item) }, secondary = true)
            }
        } else {
            PlanPreviewResult(
                state = preview,
                onApply = add,
                onRetry = add,
                onDismiss = slot.host.clearPreview,
                pending = pending,
                dateKind = page.dateKind,
                repriced = true,
                roomLines = FIT_ROOM_LINES,
                heldRoom = room,
            )
        }
    }
}

/**
 * Optional exam strategy, offered only when all of it fits before the exam and nothing the exam tests moves out. It
 * adds as the fit offer does: at once when its numbers are today's, after a check otherwise.
 */
@Composable
internal fun ExtraOfferSuggestion(
    item: SlotItem.ExtraOffer,
    slot: Slot,
) {
    val page = slot.page
    val offer = item.offer
    val preview = slot.host.preview.of(offer.operations.map { it.op }, page.plan)
    val lessons = offer.lessons.toInt()
    val label = optionalStudyLabel(page.plan.hasNotice == true, page.plan.examDocument)
    val line = factsLine(pluralStringResource(R.plurals.plan_far_lessons, lessons, lessons), label)
    val pending = slot.edits.isPending(PlanPart.Suggestion)
    val checking = preview is PlanPreviewState.Loading
    val add = { slot.host.addExtraOffer(offer) }
    val checkingWords = stringResource(R.string.plan_checking_changes)

    PlanChangeSuggestion(item, stringResource(R.string.plan_extra_offer_title), slot) {
        // The card asks: its check adds only while the card shows, so one paged away adds nothing.
        VisitOf(slot.edits.outcomes.suggestion)
        if (preview == PlanPreviewState.Idle || checking) {
            SuggestionDescription(line)
            SuggestionActions {
                SuggestionAction(
                    onClick = add,
                    modifier = if (checking) Modifier.semantics { stateDescription = checkingWords } else Modifier,
                    busy = pending || checking,
                ) { Text(stringResource(R.string.plan_add_to_my_plan)) }
                SuggestionAction(stringResource(R.string.plan_not_now), onClick = { slot.dismiss(item) }, secondary = true)
            }
        } else {
            PlanPreviewResult(
                state = preview,
                onApply = add,
                onRetry = add,
                onDismiss = slot.host.clearPreview,
                pending = pending,
                dateKind = page.dateKind,
                repriced = true,
                roomLines = 1,
            )
        }
    }
}

private const val NAMED_TOPICS = 2

/** The fit card names what it adds in a line, and a failed check says so in one. */
private const val FIT_ROOM_LINES = 1

@Composable
internal fun PastDateSuggestion(
    item: SlotItem.PastDate,
    slot: Slot,
    onAdjust: (PlanSection?) -> Unit,
) {
    if (slot.page.isExam) {
        // No actions: the page's bar holds the answers (ExamOverActions), which a sheet over it would cover. The
        // Schedule number beside it says how many lessons are left.
        val title = stringResource(R.string.plan_past_date_exam_title)
        val left = stringResource(R.string.plan_exam_over_ask)
        Suggestion(
            label = title,
            summary = title,
            layout = slot.layout,
            mark = SuggestionMark.Symbol(R.drawable.ic_calendar_clock),
            lineAction = null,
            lineDescription = left,
        ) {
            SuggestionHeader(title)
            SuggestionDescription(left)
        }
    } else {
        DateOverSuggestion(item, slot, onAdjust)
    }
}

@Composable
private fun DateOverSuggestion(
    item: SlotItem.PastDate,
    slot: Slot,
    onAdjust: (PlanSection?) -> Unit,
) {
    val page = slot.page
    val state = slot.state
    val preview = (slot.host.preview as? PlanPreviewState.Asked)?.takeIf { it.matchesPlan(page.plan) }
    val search = state.dateSearch
    val retry = search == DateSearch.Failed || search == DateSearch.Building
    val currentPlan by rememberUpdatedState(page.plan)

    fun findDate() {
        val request = ++state.searches
        state.waiting = request
        state.dateSearch = DateSearch.Finding
        slot.edits.findTimeToCover(currentPlan, TimeAsker.PastDate(request))
    }

    fun stopWaiting() {
        state.waiting = 0
        state.dateSearch = null
    }

    PlanChangeSuggestion(
        item,
        stringResource(R.string.plan_past_date_goal_title),
        slot,
    ) {
        // The card asks: paging away while the date is found stops the wait, and its answer does nothing.
        VisitOf(slot.edits.outcomes.suggestion)
        ActOn(slot.edits.outcomes.pastDateFound) { (request, found) ->
            if (state.waiting != request) return@ActOn
            state.waiting = 0
            val date = (found as? TimeToCoverOutcome.Answered)?.time?.fittingDate?.toJavaLocalDate()
            date?.let { slot.host.requestPreview(listOf(PlanOp.TargetDate(it))) }
            state.dateSearch =
                when (found) {
                    is TimeToCoverOutcome.Answered -> if (date == null) DateSearch.NoDate else null
                    TimeToCoverOutcome.Building -> DateSearch.Building
                    TimeToCoverOutcome.Failed -> DateSearch.Failed
                    TimeToCoverOutcome.Stale -> null
                }
        }
        val adjust = {
            close()
            onAdjust(PlanSection.Date)
        }

        when {
            preview != null -> {
                PlanPreviewResult(
                    dateKind = page.dateKind,
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
                    else -> SuggestionDescription(pluralStringResource(R.plurals.plan_past_date_offer, item.lessons, item.lessons))
                }
                SuggestionActions {
                    SuggestionAction(stringResource(if (retry) R.string.plan_try_again else R.string.plan_find_date), onClick = ::findDate)
                    SuggestionMenu { done ->
                        SuggestionMenuItem(stringResource(R.string.plan_adjust_plan), done, adjust)
                        SuggestionMenuItem(stringResource(R.string.plan_not_now), done) { slot.dismiss(item) }
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
