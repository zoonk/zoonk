package com.zoonk.android.feature.plan

import android.icu.text.ListFormatter
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.PlanEffectWeeklyEvents
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/*
 * What a plan change says, as main's `use-change-sentence`, `use-effect-text` and their helpers
 * write it: one sentence for what it does, then what it moves. Shared by the Plan, Today and the
 * tutor's plan-change card.
 */

private val NEVER_APPLIED = setOf(PlanChange.Status.PROPOSED, PlanChange.Status.DECLINED, PlanChange.Status.REPLACED)

/** Main's `useChangeSentence`. [targetDate] is the goal's date while it's ahead, so system changes count by it. */
@Composable
fun planChangeSentence(
    change: PlanChange,
    targetDate: LocalDate? = null,
): String {
    change.reason?.let { return it }
    val ops = change.operations.map { it.op }
    val effect = change.effect
    val neverApplied = change.status in NEVER_APPLIED

    if (change.source == NOTICE_SOURCE) return noticeSentence(ops, change.examDocument)
    if (change.source == PHASE_DATES_SOURCE && neverApplied) return phaseDatesSentence(effect)

    val first = ops.firstOrNull()
    if (change.source == OWN_LEVEL_SOURCE && first is PlanOp.AddSkills) {
        return stringResource(R.string.plan_change_own_level_first, shortList(first.names, ListKind.Topics))
    }
    if (change.source == REBALANCE_SOURCE && first is PlanOp.FocusAreas) {
        return stringResource(R.string.plan_change_rebalance, joinList(first.areas))
    }

    systemChangeSentence(change, effect, targetDate)?.let { return it }
    if (ops.isEmpty()) return coverageSentence(effect)

    return ops
        .map { op ->
            (if (neverApplied) proposedOperationSentence(op) else null) ?: operationSentence(op, change.examDocument)
        }.joinToString(" ")
}

/** Main's `useAppliedLine`: whether today's session took the change. */
@Composable
fun planChangeAppliedLine(todaySession: PlanChange.TodaySession?): String =
    stringResource(
        when (todaySession) {
            PlanChange.TodaySession.CHANGED -> R.string.plan_change_today_changed
            PlanChange.TodaySession.UNCHANGED -> R.string.plan_change_today_unchanged
            null -> R.string.plan_change_from_now_on
        },
    )

/**
 * Main's `useAppliedEffectText`: what an applied change moved. A plan with a date says its new end
 * only when it goes on past the exam; one whose date the change removed says the month it ends.
 */
@Composable
fun planChangeAppliedEffect(
    change: PlanChange,
    targetDate: LocalDate?,
    fullCourse: Boolean,
): String? = effectSentences(change.effect, appliedEndText(change, targetDate, fullCourse))

/** Main's `useProposalEffectText`, for a change offered before it's applied. [current] is the plan's end shown now, for a plan without a date. */
@Composable
fun planChangeProposalEffect(
    effect: PlanEffect?,
    current: PlanEnd? = null,
    besideDiff: Boolean = false,
    byDate: Boolean = true,
): String? {
    val end = if (current != null) planEndEffect(effect, current) else changeEffectText(effect)
    return effectSentences(effect, end, besideDiff = besideDiff, byDate = byDate)
}

/** The plan's date and estimated end, as shown before a change. */
data class PlanEnd(
    val targetDate: LocalDate?,
    val endDate: LocalDate?,
)

/**
 * Main's tutor footnote: what a change moves beyond its diff (an area's end that stays, starts,
 * reviews, the lessons it names, topics in and out).
 */
@Composable
fun planChangeFootnote(effect: PlanEffect?): String? {
    effect ?: return null
    val ends = effect.areaEnds.orEmpty()
    val sentences =
        listOfNotNull(
            *areaStartTexts(effect).toTypedArray(),
            *areaEndTexts(ends.filter { it.after == it.before }, effect.lessonsAddedEstimated == true).toTypedArray(),
            reviewFirstText(effect),
            lessonsText(effect, named = true),
            addedTopicsStartText(effect),
            topicsLeaveText(effect),
        )
    return sentences.takeIf { it.isNotEmpty() }?.joinToString(" ")
}

/** For a waiting change that would set the exam's official date: what the notice or calendar says. */
@Composable
fun planChangeOfficialDateLine(change: PlanChange): String? {
    val official = change.officialDate?.takeIf { change.status == PlanChange.Status.PROPOSED } ?: return null
    val date = longDate(official.date.toJavaLocalDate())
    return stringResource(
        if (change.examDocument == ExamDocument.NOTICE) R.string.plan_change_notice_sets_date else R.string.plan_change_calendar_sets_date,
        date,
    )
}

@Composable
fun planChangeKeepOfficialDateLabel(document: ExamDocument): String =
    stringResource(if (document == ExamDocument.NOTICE) R.string.plan_change_keep_notice_date else R.string.plan_change_keep_official_date)

/** A full-course exam plan may grow past its date, so its count isn't one by the date. */
fun countsByDate(
    effect: PlanEffect?,
    targetDate: LocalDate?,
): Boolean {
    targetDate ?: return false
    val after = effect?.endDateAfter?.toJavaLocalDate() ?: return true
    return !after.isAfter(targetDate)
}

/**
 * The end move worth saying: never a day or less while the change adds or leaves out lessons, since
 * an end a day earlier beside lessons left out reads backwards.
 */
internal fun shownEndMove(effect: PlanEffect?): Pair<LocalDate, LocalDate>? {
    effect ?: return null
    val after = effect.endDateAfter?.toJavaLocalDate() ?: return null
    val before = effect.endDateBefore?.toJavaLocalDate() ?: return null
    if (after == before) return null
    val lessonsChange = effect.lessonsAdded > 0 || effect.lessonsRemoved > 0
    val rounding = abs(ChronoUnit.DAYS.between(before, after)) <= 1
    return if (lessonsChange && rounding) null else before to after
}

private const val NOTICE_SOURCE = "notice"
private const val PHASE_DATES_SOURCE = "phaseDates"
private const val OWN_LEVEL_SOURCE = "ownLevel"
private const val REBALANCE_SOURCE = "preparation"

@Composable
internal fun longDate(date: LocalDate): String = formatDate(date, currentLocale(), DateStyle.Long)

@Composable
private fun weekdayDayDate(date: LocalDate): String = formatDate(date, currentLocale(), DateStyle.WeekdayDay)

/** Sunday is 0, as the API counts weekdays. */
@Composable
internal fun weekdayName(weekday: Int): String =
    DayOfWeek
        .of(
            if (weekday ==
                0
            ) {
                7
            } else {
                weekday
            },
        ).getDisplayName(TextStyle.FULL, currentLocale())

@Composable
internal fun joinList(items: List<String>): String = ListFormatter.getInstance(currentLocale()).format(items)

internal enum class ListKind { Lessons, Topics }

/**
 * Main's `useShortList`: three names and how many more. Topics drop the notice's numbering ("12
 * Noções…" read as a count); lessons count the rest without a unit.
 */
@Composable
internal fun shortList(
    listed: List<String>,
    kind: ListKind,
    named: Int = NAMED,
): String {
    val names = if (kind == ListKind.Topics) listed.map(::topicWords) else listed
    val shown = names.take(named)
    val more = names.size - shown.size
    if (more == 0) return joinList(shown)
    val first = shown.joinToString(", ")
    return if (kind == ListKind.Lessons) {
        pluralStringResource(R.plurals.plan_change_names_and_more, more, first, more)
    } else {
        pluralStringResource(R.plurals.plan_change_names_and_more_topics, more, first, more)
    }
}

private const val NAMED = 3

@Composable
private fun examples(names: List<String>): String = joinList(names.take(NAMED))

/** A notice's item number or code before a topic ("1.2", "H18 –"), never a year opening one. */
internal fun topicWords(name: String): String = (ITEM_NUMBER.matchEntire(name) ?: ITEM_CODE.matchEntire(name))?.groupValues?.get(2) ?: name

private val ITEM_NUMBER = Regex("""^\s*(\d{1,3}(?:\.\d{1,3})*)\.?\s+(\S.*)$""", RegexOption.DOT_MATCHES_ALL)
private val ITEM_CODE = Regex("""^\s*([A-Z]{1,3}\d{1,3})\s*[-–—:]\s+(\S.*)$""", RegexOption.DOT_MATCHES_ALL)

@Composable
private fun noticeSentence(
    ops: List<PlanOp>,
    document: ExamDocument,
): String {
    val notice = document == ExamDocument.NOTICE
    val follows = ops.any { it is PlanOp.FollowNotice }
    val day = ops.filterIsInstance<PlanOp.NoticeDate>().firstOrNull()
    val date = day?.let { longDate(it.date) }

    return when {
        follows && day != null && day.estimated -> {
            stringResource(if (notice) R.string.plan_change_read_notice_around else R.string.plan_change_read_guide_around, date!!)
        }

        follows && day != null -> {
            stringResource(if (notice) R.string.plan_change_read_notice_on else R.string.plan_change_read_guide_on, date!!)
        }

        follows -> {
            stringResource(if (notice) R.string.plan_change_read_notice else R.string.plan_change_read_guide)
        }

        day != null -> {
            noticeDayText(day.date, day.estimated, document)
        }

        else -> {
            followsNotice(document)
        }
    }
}

@Composable
fun noticeDayText(
    date: LocalDate,
    estimated: Boolean,
    document: ExamDocument,
): String =
    when {
        estimated -> stringResource(R.string.plan_change_likely_date, longDate(date))
        document == ExamDocument.NOTICE -> stringResource(R.string.plan_change_notice_says, longDate(date))
        else -> stringResource(R.string.plan_change_calendar_says, longDate(date))
    }

@Composable
private fun followsNotice(document: ExamDocument): String =
    stringResource(if (document == ExamDocument.NOTICE) R.string.plan_change_follows_notice else R.string.plan_change_follows_guide)

/** For a change never applied: "Daily time: 40 min.", never "changed to" unless the learner said yes. */
@Composable
private fun proposedOperationSentence(op: PlanOp): String? =
    when (op) {
        is PlanOp.DailyMinutes -> {
            stringResource(R.string.plan_change_daily_time, formatMinutes(op.minutes, currentLocale()))
        }

        is PlanOp.MoveWeeklyEvent -> {
            stringResource(R.string.plan_change_weekly_challenge, longDate(op.to))
        }

        is PlanOp.TargetDate -> {
            op.date?.let { stringResource(R.string.plan_change_goal_date, longDate(it)) }
        }

        is PlanOp.NoticeDate -> {
            stringResource(R.string.plan_change_goal_date, longDate(op.date))
        }

        is PlanOp.SkipActivities -> {
            stringResource(R.string.plan_change_leave_out, activityList(op.activities))
        }

        is PlanOp.RestoreActivities -> {
            stringResource(R.string.plan_change_back_in_lessons, activityList(op.activities))
        }

        is PlanOp.SkipAreas -> {
            stringResource(R.string.plan_change_leave_out_of_plan, joinList(op.areas))
        }

        is PlanOp.RestoreAreas -> {
            stringResource(R.string.plan_change_back_in_plan, joinList(op.areas))
        }

        is PlanOp.AddSkills -> {
            stringResource(R.string.plan_change_add_to_plan, shortList(op.names, ListKind.Topics))
        }

        is PlanOp.PracticeBias -> {
            stringResource(
                if (op.bias ==
                    "morePractice"
                ) {
                    R.string.plan_change_suggest_more_practice
                } else {
                    R.string.plan_change_suggest_more_explanation
                },
            )
        }

        is PlanOp.DifficultyBias -> {
            stringResource(
                when (op.bias) {
                    "harder" -> R.string.plan_change_suggest_harder
                    "easier" -> R.string.plan_change_suggest_easier
                    else -> R.string.plan_change_suggest_usual_difficulty
                },
            )
        }

        else -> {
            null
        }
    }

@Composable
private fun operationSentence(
    op: PlanOp,
    document: ExamDocument,
): String =
    when (op) {
        is PlanOp.DailyMinutes -> {
            stringResource(R.string.plan_change_daily_time_changed, formatMinutes(op.minutes, currentLocale()))
        }

        is PlanOp.WeekdayMinutes -> {
            val days = joinList(op.weekdays.map { weekdayName(it) }).replaceFirstChar { it.titlecase(currentLocale()) }
            if (op.minutes == 0) {
                stringResource(R.string.plan_change_rest_day, days)
            } else {
                stringResource(R.string.plan_change_days_time, days, formatMinutes(op.minutes, currentLocale()))
            }
        }

        is PlanOp.LightWeek -> {
            stringResource(R.string.plan_change_light_week, longDate(op.startDate))
        }

        is PlanOp.MoveWeeklyEvent -> {
            stringResource(R.string.plan_change_weekly_challenge_moved, longDate(op.to))
        }

        is PlanOp.SkipActivities -> {
            stringResource(R.string.plan_change_activities_left_out, activityList(op.activities))
        }

        is PlanOp.RestoreActivities -> {
            stringResource(R.string.plan_change_activities_back, activityList(op.activities))
        }

        is PlanOp.PracticeBias -> {
            stringResource(if (op.bias == "morePractice") R.string.plan_change_more_practice else R.string.plan_change_more_explanation)
        }

        is PlanOp.DifficultyBias -> {
            difficultySentence(op.bias)
        }

        is PlanOp.WrittenCadence -> {
            stringResource(
                when (op.cadence) {
                    "biweekly" -> R.string.plan_change_writing_biweekly
                    "finalWeeks" -> R.string.plan_change_writing_final_weeks
                    else -> R.string.plan_change_writing_weekly
                },
            )
        }

        is PlanOp.AddSkills -> {
            pluralStringResource(R.plurals.plan_change_skills_come_in, op.names.size, shortList(op.names, ListKind.Topics))
        }

        PlanOp.FollowNotice -> {
            followsNotice(document)
        }

        is PlanOp.NoticeDate -> {
            stringResource(R.string.plan_change_date_moved, longDate(op.date))
        }

        is PlanOp.Tools -> {
            toolSentence(op.tools)
        }

        PlanOp.FitPhaseDates -> {
            stringResource(R.string.plan_change_phase_dates_moved)
        }

        PlanOp.FitLessons -> {
            stringResource(R.string.plan_change_fit_lessons)
        }

        is PlanOp.ExamChoice -> {
            stringResource(R.string.plan_change_exam_choice, op.subject, op.group)
        }

        is PlanOp.TargetDate -> {
            op.date?.let { stringResource(R.string.plan_change_date_moved, longDate(it)) }
                ?: stringResource(R.string.plan_change_no_deadline)
        }

        is PlanOp.FullCourse -> {
            stringResource(if (op.fullCourse) R.string.plan_change_full_course else R.string.plan_change_ends_at_exam)
        }

        is PlanOp.BaseChoices -> {
            baseChoicesSentence(op.choices)
        }

        is PlanOp.FocusAreas -> {
            val names = op.areas.map { area -> op.parts.firstOrNull { it.area == area }?.name ?: area }
            stringResource(R.string.plan_change_more_time_for, joinList(names))
        }

        is PlanOp.ReduceAreas -> {
            stringResource(R.string.plan_change_less_time_for, joinList(op.areas))
        }

        is PlanOp.SkipAreas -> {
            stringResource(R.string.plan_change_areas_left_out, joinList(op.areas))
        }

        is PlanOp.RestoreAreas -> {
            stringResource(R.string.plan_change_areas_back, joinList(op.areas))
        }

        is PlanOp.AreaStart -> {
            stringResource(
                if (op.pastBasics) R.string.plan_change_start_past_basics else R.string.plan_change_start_from_basics,
                joinList(op.areas),
            )
        }

        PlanOp.Unknown -> {
            stringResource(R.string.plan_change_changed)
        }
    }

@Composable
private fun activityList(activities: List<String>): String =
    joinList(
        activities.map {
            stringResource(
                when (it) {
                    "vocabulary" -> R.string.plan_activity_vocabulary
                    "listening" -> R.string.plan_activity_listening
                    "writing" -> R.string.plan_activity_writing
                    else -> R.string.plan_activity_speaking
                },
            )
        },
    )

@Composable
fun difficultySentence(bias: String): String =
    stringResource(
        when (bias) {
            "harder" -> R.string.plan_change_harder
            "easier" -> R.string.plan_change_easier
            else -> R.string.plan_change_usual_difficulty
        },
    )

@Composable
private fun baseChoicesSentence(choices: List<BaseChoice>): String {
    fun count(choice: String) = choices.count { it.choice == choice }
    val deep = count("deep")
    val essential = count("essential")
    val quick = count("quick")
    val skip = count("skip")
    return listOfNotNull(
        if (deep > 0) pluralStringResource(R.plurals.plan_change_bases_deep, deep, deep) else null,
        if (essential > 0) pluralStringResource(R.plurals.plan_change_bases_essential, essential, essential) else null,
        if (quick > 0) pluralStringResource(R.plurals.plan_change_bases_quick, quick, quick) else null,
        if (skip > 0) pluralStringResource(R.plurals.plan_change_bases_skip, skip, skip) else null,
    ).joinToString(" ")
}

@Composable
private fun toolSentence(tools: List<ToolPick>): String {
    val names = joinList(tools.map { it.name })
    val first = tools.firstOrNull()
    val system = first?.system
    return when {
        first?.choice == "setup" && system != null -> stringResource(R.string.plan_change_tool_setup, names, systemName(system))
        first?.choice == "have" -> stringResource(R.string.plan_change_tool_have, names)
        else -> stringResource(R.string.plan_change_tool_none, names)
    }
}

/** Main's `useSystemName`: `phone` is a phone with no computer. */
@Composable
fun systemName(system: String): String =
    when (system) {
        "chromebook" -> stringResource(R.string.plan_system_chromebook)
        "linux" -> stringResource(R.string.plan_system_linux)
        "macos" -> stringResource(R.string.plan_system_macos)
        "phone" -> stringResource(R.string.plan_system_phone)
        else -> stringResource(R.string.plan_system_windows)
    }

@Composable
private fun systemChangeSentence(
    change: PlanChange,
    effect: PlanEffect?,
    targetDate: LocalDate?,
): String? {
    fun join(vararg parts: String?) = parts.filterNotNull().joinToString(" ")
    return when (change.kind) {
        "missedDays" -> {
            join(stringResource(R.string.plan_change_missed_days), phaseEndsText(effect), topicsMoved(effect))
        }

        "estimateUpdated" -> {
            join(estimateSentence(effect, targetDate), phaseEndsText(effect)).ifEmpty { null }
        }

        "testedOut" -> {
            val lessons = change.lessonsSkipped.toInt()
            join(pluralStringResource(R.plurals.plan_change_tested_out, lessons, lessons), topicsMoved(effect))
        }

        // Its own sentence names the topics it brings back.
        "relearn" -> {
            join(relearnSentence(effect), topicsMoved(effect, added = false))
        }

        "coverageChanged" -> {
            coverageSentence(effect)
        }

        else -> {
            null
        }
    }
}

@Composable
private fun relearnSentence(effect: PlanEffect?): String {
    val areas = effect?.topicsAdded.orEmpty()
    val topics = areas.flatMap { area -> area.topics.map(::topicWords) }
    if (topics.size <= MAX_NAMED_TOPICS) {
        return pluralStringResource(R.plurals.plan_change_relearn_topics, topics.size, joinList(topics))
    }
    val named = areas.take(MAX_NAMED_SUBJECTS).map { it.area }
    val more = areas.size - named.size
    val subjects = named + if (more > 0) listOf(pluralStringResource(R.plurals.plan_change_other_subjects, more, more)) else emptyList()
    return pluralStringResource(R.plurals.plan_change_relearn_subjects, topics.size, topics.size, joinList(subjects))
}

private const val MAX_NAMED_TOPICS = 3
private const val MAX_NAMED_SUBJECTS = 3

@Composable
private fun estimateSentence(
    effect: PlanEffect?,
    targetDate: LocalDate?,
): String? {
    val more = ((effect?.lessonsAdded ?: 0) - (effect?.lessonsRemoved ?: 0)).toInt()
    if (more == 0) return null
    val about = effect?.lessonsAddedEstimated == true
    val count =
        if (!countsByDate(effect, targetDate)) {
            when {
                more < 0 -> pluralStringResource(R.plurals.plan_change_goal_takes_fewer, -more, -more)
                about -> pluralStringResource(R.plurals.plan_change_goal_takes_about_more, more, more)
                else -> pluralStringResource(R.plurals.plan_change_goal_takes_more, more, more)
            }
        } else {
            when {
                more < 0 -> pluralStringResource(R.plurals.plan_change_no_longer_fit, -more, -more)
                about -> pluralStringResource(R.plurals.plan_change_about_more_fit, more, more)
                else -> pluralStringResource(R.plurals.plan_change_more_fit, more, more)
            }
        }
    return "$count ${stringResource(R.string.plan_change_time_lessons_need)}"
}

/**
 * Main's `useTopicsMovedSentence`: `added = false` leaves out the topics it brings in, for a change
 * whose sentence names them; [named] caps the names said.
 */
@Composable
internal fun topicsMoved(
    effect: PlanEffect?,
    added: Boolean = true,
    named: Int = NAMED,
): String? {
    val out = effect?.topicsLeftOut.orEmpty().flatMap { it.topics }
    val back = if (added) effect?.topicsAdded.orEmpty().flatMap { it.topics } else emptyList()
    val sentences =
        listOfNotNull(
            if (out.isNotEmpty()) {
                pluralStringResource(
                    R.plurals.plan_change_topics_no_longer_fit,
                    out.size,
                    shortList(out, ListKind.Topics, named),
                )
            } else {
                null
            },
            if (back.isNotEmpty()) {
                pluralStringResource(
                    R.plurals.plan_change_topics_now_fit,
                    back.size,
                    shortList(back, ListKind.Topics, named),
                )
            } else {
                null
            },
        )
    return sentences.takeIf { it.isNotEmpty() }?.joinToString(" ")
}

@Composable
private fun coverageSentence(effect: PlanEffect?): String {
    val sentence =
        if (effect?.fromPlacement == true) {
            val back = effect.topicsAdded.orEmpty().flatMap { it.topics }
            val out = effect.topicsLeftOut.orEmpty().flatMap { it.topics }
            val lines =
                listOfNotNull(
                    if (back.isNotEmpty()) stringResource(R.string.plan_change_now_in_plan, shortList(back, ListKind.Topics)) else null,
                    if (out.isNotEmpty()) stringResource(R.string.plan_change_out_of_plan, shortList(out, ListKind.Topics)) else null,
                )
            if (lines.isEmpty()) null else (listOf(stringResource(R.string.plan_change_placement_changed)) + lines).joinToString(" ")
        } else {
            topicsMoved(effect)
        }
    return sentence ?: stringResource(R.string.plan_change_changed)
}

@Composable
private fun phaseDatesSentence(effect: PlanEffect?): String {
    val moves = effect?.phaseEnds.orEmpty()
    val late = moves.filter { it.lessonsFirst == true }
    val resting = moves.filter { it.restDay == true }
    val outcomes = effect?.outcomesAdded.orEmpty()
    val first = late.firstOrNull()
    val rest = resting.firstOrNull()
    return when {
        late.size > 1 -> {
            stringResource(R.string.plan_change_phase_dates_late_many)
        }

        first != null -> {
            val days = ChronoUnit.DAYS.between(first.before.toJavaLocalDate(), first.after.toJavaLocalDate()).toInt()
            pluralStringResource(R.plurals.plan_change_phase_dates_late_one, days, first.name, days)
        }

        resting.size > 1 -> {
            pluralStringResource(R.plurals.plan_change_phase_dates_rest_many, resting.size, resting.size)
        }

        rest != null -> {
            stringResource(R.string.plan_change_phase_dates_rest_one, rest.name, weekdayDayDate(rest.before.toJavaLocalDate()))
        }

        outcomes.isNotEmpty() -> {
            stringResource(R.string.plan_change_phase_dates_outcomes, joinList(outcomes))
        }

        (effect?.lessonsAdded ?: 0) > 0 -> {
            stringResource(R.string.plan_change_phase_dates_lessons)
        }

        else -> {
            stringResource(R.string.plan_change_phase_dates_room)
        }
    }
}

@Composable
private fun phaseEndsText(effect: PlanEffect?): String? {
    val move = effect?.phaseEnds?.singleOrNull() ?: return null
    return stringResource(
        R.string.plan_change_phase_ends,
        move.name,
        longDate(move.after.toJavaLocalDate()),
        longDate(move.before.toJavaLocalDate()),
    )
}

@Composable
internal fun phaseEndRows(effect: PlanEffect?): List<String> {
    val moves = effect?.phaseEnds.orEmpty()
    if (moves.size < 2) return emptyList()
    return moves.map {
        stringResource(
            R.string.plan_change_phase_end_row,
            it.name,
            longDate(it.after.toJavaLocalDate()),
            longDate(it.before.toJavaLocalDate()),
        )
    }
}

@Composable
private fun changeEffectText(effect: PlanEffect?): String? {
    val (before, after) = shownEndMove(effect) ?: return null
    return stringResource(R.string.plan_change_ends_instead, longDate(after), longDate(before))
}

/** Only a plan without a date says its new end, and only while the change starts from the end the plan shows now. */
@Composable
private fun planEndEffect(
    effect: PlanEffect?,
    current: PlanEnd,
): String? {
    val (before, after) = shownEndMove(effect) ?: return null
    val end = current.endDate ?: return null
    if (current.targetDate != null) return null
    val locale = currentLocale()
    val today = LocalDate.now()
    val afterText = formatPlanDate(after, today, locale)
    val beforeText = formatPlanDate(before, today, locale)
    if (beforeText != formatPlanDate(end, today, locale) || afterText == beforeText) return null
    return stringResource(R.string.plan_change_ends_around_instead, afterText, beforeText)
}

/** A plan the change took the date off says its end by month: "instead of" the last lesson's day misread as the deadline. */
@Composable
private fun appliedEndText(
    change: PlanChange,
    targetDate: LocalDate?,
    fullCourse: Boolean,
): String? {
    val effect = change.effect
    val after = effect?.endDateAfter?.toJavaLocalDate() ?: return null
    if (targetDate != null && !fullCourse) return null
    val removesDate =
        change.operations.map { it.op }.any { (it is PlanOp.TargetDate && it.date == null) || (it is PlanOp.FullCourse && it.fullCourse) }
    val locale = currentLocale()
    if (removesDate) return stringResource(R.string.plan_change_finish_around, formatDate(after, locale, DateStyle.Month))
    val before = effect.endDateBefore?.toJavaLocalDate() ?: return null
    shownEndMove(effect) ?: return null

    @Composable
    fun shown(date: LocalDate) =
        if (targetDate !=
            null
        ) {
            formatDate(date, locale, DateStyle.Month)
        } else {
            formatPlanDate(date, LocalDate.now(), locale)
        }
    val afterText = shown(after)
    val beforeText = shown(before)
    return if (afterText == beforeText) null else stringResource(R.string.plan_change_ends_around_instead, afterText, beforeText)
}

@Composable
private fun effectSentences(
    effect: PlanEffect?,
    endText: String?,
    besideDiff: Boolean = false,
    byDate: Boolean = true,
): String? {
    val sentences =
        listOfNotNull(
            *areaStartTexts(effect).toTypedArray(),
            *areaEndTexts(effect?.areaEnds.orEmpty(), effect?.lessonsAddedEstimated == true).toTypedArray(),
            *areaLessonTexts(effect).toTypedArray(),
            reviewFirstText(effect),
            weeklyEventsText(effect),
            nextMockText(effect),
            lessonsText(effect, byDate = byDate, named = besideDiff),
            phaseEndsText(effect),
            addedTopicsStartText(effect),
            topicsLeaveText(effect),
            endText,
        )
    return sentences.takeIf { it.isNotEmpty() }?.joinToString(" ")
}

/** The learner is the subject, so an area's name never needs a verb to agree with it. */
@Composable
private fun areaStartTexts(effect: PlanEffect?): List<String> {
    val ends = effect?.areaEnds.orEmpty()
    val starts =
        effect?.areaStarts.orEmpty().filter { start ->
            start.after != start.before || (effect?.reviewFirst == null && ends.none { it.area == start.area })
        }
    return starts.mapNotNull { start ->
        val after = start.after?.toJavaLocalDate() ?: return@mapNotNull null
        val before = start.before?.toJavaLocalDate()
        when {
            before == null -> stringResource(R.string.plan_change_start_area_on, start.area, longDate(after))
            before != after -> stringResource(R.string.plan_change_start_area_instead, start.area, longDate(after), longDate(before))
            else -> stringResource(R.string.plan_change_still_start_area, start.area, longDate(after))
        }
    }
}

@Composable
private fun areaEndTexts(
    ends: List<com.zoonk.api.models.PlanEffectAreaEndsInner>,
    estimated: Boolean,
): List<String> =
    ends.map { end ->
        val after = end.after.toJavaLocalDate()
        val before = end.before.toJavaLocalDate()
        val gained = (end.lessonsGained ?: 0).toInt()
        val afterText = longDate(after)
        val beforeText = longDate(before)
        when {
            after == before -> {
                stringResource(R.string.plan_change_still_finish_area, end.area, afterText)
            }

            gained > 0 && after.isAfter(before) -> {
                if (estimated) {
                    pluralStringResource(R.plurals.plan_change_area_gets_about_more, gained, end.area, gained, afterText, beforeText)
                } else {
                    pluralStringResource(R.plurals.plan_change_area_gets_more, gained, end.area, gained, afterText, beforeText)
                }
            }

            gained < 0 && after.isBefore(before) -> {
                pluralStringResource(R.plurals.plan_change_area_fewer, -gained, end.area, -gained, afterText, beforeText)
            }

            else -> {
                stringResource(R.string.plan_change_finish_area_instead, end.area, afterText, beforeText)
            }
        }
    }

@Composable
private fun areaLessonTexts(effect: PlanEffect?): List<String> =
    effect?.areaLessons.orEmpty().map {
        pluralStringResource(R.plurals.plan_change_area_lessons_to_go, it.after.toInt(), it.area, it.after.toInt(), it.before.toInt())
    }

@Composable
private fun addedTopicsStartText(effect: PlanEffect?): String? {
    val start = effect?.addedTopicsStart?.toJavaLocalDate() ?: return null
    return stringResource(
        if (effect.addedTopicsBeforeBasics ==
            true
        ) {
            R.string.plan_change_new_lessons_before_basics
        } else {
            R.string.plan_change_new_lessons_start
        },
        longDate(start),
    )
}

@Composable
private fun reviewFirstText(effect: PlanEffect?): String? {
    val review = effect?.reviewFirst ?: return null
    return stringResource(R.string.plan_change_review_first, longDate(review.date.toJavaLocalDate()), joinList(review.areas))
}

@Composable
private fun weeklyEventsText(effect: PlanEffect?): String? {
    val moved = effect?.weeklyEvents ?: return null
    val day = weekdayName(moved.after.toInt())
    return stringResource(
        if (moved.kind ==
            PlanEffectWeeklyEvents.Kind.MOCK
        ) {
            R.string.plan_change_weekly_mocks_move
        } else {
            R.string.plan_change_weekly_challenges_move
        },
        day,
    )
}

@Composable
private fun nextMockText(effect: PlanEffect?): String? {
    val moved = effect?.nextMock ?: return null
    return stringResource(R.string.plan_change_next_mock_moves, weekdayDayDate(moved.after.toJavaLocalDate()))
}

@Composable
private fun topicsLeaveText(effect: PlanEffect?): String? {
    val topics = effect?.topicsLeftOut.orEmpty().flatMap { it.topics }
    if (topics.isEmpty()) return null
    return pluralStringResource(R.plurals.plan_change_topics_leave, topics.size, topics.size, shortList(topics, ListKind.Topics))
}

/**
 * Main's `useLessonsEffectText`: lessons added and left out. Without a date the plan keeps every
 * lesson, so it has fewer or more of them, never "left out". When names aren't one per lesson, a
 * few are examples ("such as A, B and C"). Beside a diff ([named]), which counts them first, only a
 * sentence naming the lessons left out says more.
 */
@Composable
internal fun lessonsText(
    effect: PlanEffect?,
    byDate: Boolean = true,
    named: Boolean = false,
): String? {
    val added = (effect?.lessonsAdded ?: 0).toInt()
    val about = effect?.lessonsAddedEstimated == true
    val removed = (effect?.lessonsRemoved ?: 0).toInt()
    val leftOut = effect?.lessonsLeftOut.orEmpty()
    val someOf = leftOut.size != removed
    val names =
        if (leftOut.isEmpty()) {
            null
        } else if (someOf) {
            examples(leftOut)
        } else {
            shortList(leftOut, ListKind.Lessons)
        }
    val unwritten =
        effect
            ?.unwrittenLeftOut
            .orEmpty()
            .map {
                pluralStringResource(R.plurals.plan_change_unwritten_skill, it.lessons.toInt(), it.skill, it.lessons.toInt())
            }.let {
                if (it.isEmpty()) null else stringResource(R.string.plan_change_unwritten, joinList(it))
            }
    if (named) {
        // Beside a diff, which already counts them, only the names say more. Lessons swapped within a
        // skill remove none in total, so the diff has no count for them and the names keep "and N more".
        val shown = if (removed == 0 && leftOut.isNotEmpty()) shortList(leftOut, ListKind.Lessons) else names
        val left =
            shown?.let {
                stringResource(
                    if (someOf &&
                        removed > 0
                    ) {
                        R.string.plan_change_left_out_include
                    } else {
                        R.string.plan_change_left_out
                    },
                    it,
                )
            }
        return listOfNotNull(left, unwritten).joinToString(" ").ifEmpty { null }
    }

    val counts = lessonCounts(added, about, removed, names, someOf, byDate)
    // Counts net skill by skill, so a lesson swapped within its skill still needs its name.
    val netted =
        if (removed == 0 && leftOut.isNotEmpty()) {
            lessonCounts(0, false, leftOut.size, shortList(leftOut, ListKind.Lessons), someOf = false, byDate = true)
        } else {
            null
        }
    return listOfNotNull(counts, netted, unwritten).joinToString(" ").ifEmpty { null }
}

@Composable
private fun lessonCounts(
    added: Int,
    about: Boolean,
    removed: Int,
    names: String?,
    someOf: Boolean,
    byDate: Boolean,
): String? {
    val addedWords =
        when {
            byDate && about -> pluralStringResource(R.plurals.plan_change_adds_about, added, added)
            byDate -> pluralStringResource(R.plurals.plan_change_adds, added, added)
            about -> pluralStringResource(R.plurals.plan_change_about_more_lessons, added, added)
            else -> pluralStringResource(R.plurals.plan_change_more_lessons, added, added)
        }
    val removedWords =
        if (byDate) {
            pluralStringResource(R.plurals.plan_change_leaves_out, removed, removed)
        } else {
            pluralStringResource(R.plurals.plan_change_fewer_lessons, removed, removed)
        }
    val both = added > 0 && removed > 0
    return when {
        both && byDate -> {
            val counts = pluralStringResource(R.plurals.plan_change_adds_and_leaves_out, removed, addedWords, removed)
            withNames(counts, names, someOf)
        }

        both -> {
            val counts =
                stringResource(
                    R.string.plan_change_more_and_fewer,
                    addedWords,
                    pluralStringResource(R.plurals.plan_change_fewer, removed, removed),
                )
            withNames(counts, names, someOf)
        }

        added > 0 -> {
            stringResource(R.string.plan_change_sentence, addedWords)
        }

        removed > 0 -> {
            withNames(removedWords, names, someOf)
        }

        else -> {
            null
        }
    }
}

@Composable
private fun withNames(
    counts: String,
    names: String?,
    someOf: Boolean,
): String =
    when {
        names == null -> stringResource(R.string.plan_change_sentence, counts)
        someOf -> stringResource(R.string.plan_change_such_as, counts, names)
        else -> stringResource(R.string.plan_change_named, counts, names)
    }
