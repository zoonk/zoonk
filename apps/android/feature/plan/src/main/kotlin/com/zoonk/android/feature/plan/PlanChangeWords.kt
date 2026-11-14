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
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanEffect
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

/** What a plan change says: [title], the question a proposal asks or what an applied change did, and at most one [why]. */
data class ChangeWords(
    val title: String,
    val why: String?,
)

/**
 * Main's `useChangeWords`: a change nobody applied yet asks a question in the learner's words; once
 * applied it says what it did. What it moves is never said here: that's its effect ([PlanEffectDiff]).
 */
@Composable
fun planChangeWords(
    change: PlanChange,
    dateKind: GoalDateKind = GoalDateKind.Unknown,
): ChangeWords {
    val ops = change.operations.map { it.op }
    val first = ops.firstOrNull()

    systemChangeSentence(change)?.let { return ChangeWords(it, null) }
    if (change.source == OWN_LEVEL_SOURCE && first is PlanOp.AddSkills) {
        return ChangeWords(stringResource(R.string.plan_change_own_level_first, shortList(first.names, ListKind.Topics)), null)
    }
    if (change.source == FOCUS_TEST_SOURCE && first is PlanOp.FocusAreas && first.areas.isNotEmpty()) {
        return ChangeWords(stringResource(R.string.plan_change_focus_test, joinList(first.areas)), null)
    }

    val statements = @Composable { ops.map { operationStatement(it, change.examDocument, dateKind) }.joinSentences() }
    if (change.status !in NEVER_APPLIED) {
        return ChangeWords(if (ops.isEmpty()) stringResource(R.string.plan_change_changed) else statements(), null)
    }

    if (change.source == NOTICE_SOURCE) return ChangeWords(guideQuestion(ops, change.examDocument), change.reason)
    if (change.source == PHASE_DATES_SOURCE) {
        val phaseDates = phaseDatesQuestion(change.effect)
        return ChangeWords(phaseDates.title, change.reason ?: phaseDates.why)
    }
    val own = first?.takeIf { ops.size == 1 }?.let { operationQuestion(it, dateKind) }
    if (own != null) return ChangeWords(own, change.reason)
    return ChangeWords(stringResource(R.string.plan_ask_change), change.reason ?: statements().ifEmpty { null })
}

/** The title alone, where a change shows in one line. */
@Composable
fun planChangeSentence(
    change: PlanChange,
    dateKind: GoalDateKind = GoalDateKind.Unknown,
): String = planChangeWords(change, dateKind).title

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

/** For a waiting change that would set the exam's official date: what the notice or calendar says. */
@Composable
fun planChangeOfficialDateLine(change: PlanChange): String? {
    val official = change.officialDate?.takeIf { change.status == PlanChange.Status.PROPOSED } ?: return null
    return stringResource(R.string.plan_change_official_date, longDate(official.date.toJavaLocalDate()))
}

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

/** A focus the learner's Focus test answers suggest, which they apply as "Update my plan". */
const val FOCUS_TEST_SOURCE = "focusTest"

@Composable
internal fun longDate(date: LocalDate): String = formatDate(date, currentLocale(), DateStyle.Long)

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

/** Main's `useGuideQuestion`: following the exam's guide, its date, or both. */
@Composable
private fun guideQuestion(
    ops: List<PlanOp>,
    document: ExamDocument,
): String {
    val follows = ops.any { it is PlanOp.FollowNotice }
    val day = ops.filterIsInstance<PlanOp.NoticeDate>().firstOrNull()
    val date = day?.let { longDate(it.date) }

    return when {
        follows && date != null -> {
            stringResource(
                if (day.estimated) R.string.plan_ask_follow_guide_around else R.string.plan_ask_follow_guide_on,
                date,
            )
        }

        follows -> {
            stringResource(R.string.plan_ask_follow_guide)
        }

        date != null -> {
            stringResource(if (day.estimated) R.string.plan_ask_exam_date_around else R.string.plan_ask_exam_date, date)
        }

        else -> {
            stringResource(R.string.plan_change_follows_guide)
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

/** Main's `useOperationQuestion`: a change nobody applied yet is a question; null when the operation has none of its own. */
@Composable
private fun operationQuestion(
    op: PlanOp,
    dateKind: GoalDateKind,
): String? {
    val locale = currentLocale()
    return when (op) {
        is PlanOp.AddSkills -> {
            stringResource(R.string.plan_ask_add_topics, shortList(op.names, ListKind.Topics))
        }

        is PlanOp.FocusAreas -> {
            if (op.areas.isEmpty()) {
                stringResource(
                    R.string.plan_ask_remove_focus,
                )
            } else {
                stringResource(R.string.plan_ask_focus, focusNames(op))
            }
        }

        is PlanOp.ReduceAreas -> {
            stringResource(R.string.plan_ask_less_time, joinList(op.areas))
        }

        is PlanOp.SkipAreas -> {
            stringResource(R.string.plan_ask_skip_areas, joinList(op.areas))
        }

        is PlanOp.RestoreAreas -> {
            stringResource(R.string.plan_ask_restore_areas, joinList(op.areas))
        }

        is PlanOp.AreaStart -> {
            stringResource(if (op.pastBasics) R.string.plan_ask_skip_basics else R.string.plan_ask_from_basics, joinList(op.areas))
        }

        is PlanOp.DailyMinutes -> {
            stringResource(R.string.plan_ask_daily_time, formatMinutes(op.minutes, locale))
        }

        is PlanOp.WeekdayMinutes -> {
            val days = joinList(op.weekdays.map { weekdayName(it) })
            when {
                op.minutes != 0 -> stringResource(R.string.plan_ask_days_time, formatMinutes(op.minutes, locale), days)
                op.weekdays.size == 1 -> stringResource(R.string.plan_ask_rest_day, days)
                else -> stringResource(R.string.plan_ask_rest_days, days)
            }
        }

        is PlanOp.LightWeek -> {
            stringResource(R.string.plan_ask_light_week, longDate(op.startDate))
        }

        is PlanOp.MoveWeeklyEvent -> {
            stringResource(R.string.plan_ask_move_challenge, longDate(op.to))
        }

        is PlanOp.TargetDate -> {
            op.date?.let { dateQuestion(it, dateKind) } ?: stringResource(R.string.plan_ask_no_end_date)
        }

        is PlanOp.NoticeDate -> {
            dateQuestion(op.date, dateKind)
        }

        is PlanOp.FullCourse -> {
            stringResource(if (op.fullCourse) R.string.plan_ask_keep_studying else R.string.plan_ask_end_at_exam)
        }

        is PlanOp.PracticeBias -> {
            stringResource(if (op.bias == "morePractice") R.string.plan_ask_more_practice else R.string.plan_ask_more_explanation)
        }

        is PlanOp.DifficultyBias -> {
            stringResource(
                when (op.bias) {
                    "harder" -> R.string.plan_ask_harder
                    "easier" -> R.string.plan_ask_easier
                    else -> R.string.plan_ask_usual_difficulty
                },
            )
        }

        is PlanOp.SkipActivities -> {
            stringResource(R.string.plan_ask_skip_activities, activityList(op.activities))
        }

        is PlanOp.RestoreActivities -> {
            stringResource(R.string.plan_ask_restore_activities, activityList(op.activities))
        }

        is PlanOp.BaseChoices -> {
            stringResource(R.string.plan_ask_prerequisites)
        }

        is PlanOp.Aim -> {
            stringResource(R.string.plan_ask_aim, op.aim)
        }

        PlanOp.FitLessons -> {
            stringResource(R.string.plan_ask_fit_lessons)
        }

        else -> {
            null
        }
    }
}

@Composable
private fun dateQuestion(
    date: LocalDate,
    dateKind: GoalDateKind,
): String =
    stringResource(
        when (dateKind) {
            GoalDateKind.Exam -> R.string.plan_ask_exam_date
            GoalDateKind.Goal -> R.string.plan_ask_end_date
            GoalDateKind.Unknown -> R.string.plan_ask_date
        },
        longDate(date),
    )

/** A focus names its subjects by the parts the learner sees. */
@Composable
private fun focusNames(op: PlanOp.FocusAreas): String =
    joinList(
        op.areas.map { area ->
            op.parts.firstOrNull { it.area == area }?.name
                ?: area
        },
    )

/** Main's `useOperationStatement`: what an applied operation did. */
@Composable
private fun operationStatement(
    op: PlanOp,
    document: ExamDocument,
    dateKind: GoalDateKind,
): String =
    when (op) {
        is PlanOp.Aim -> {
            stringResource(R.string.plan_change_aim, op.aim)
        }

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
            stringResource(R.string.plan_change_topics_added, shortList(op.names, ListKind.Topics))
        }

        PlanOp.FollowNotice -> {
            stringResource(R.string.plan_change_follows_guide)
        }

        is PlanOp.NoticeDate -> {
            dateStatement(op.date, dateKind)
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
            stringResource(R.string.plan_change_exam_choice, op.group, joinList(op.subjects))
        }

        is PlanOp.TargetDate -> {
            op.date?.let { dateStatement(it, dateKind) } ?: stringResource(R.string.plan_change_no_deadline)
        }

        is PlanOp.FullCourse -> {
            stringResource(if (op.fullCourse) R.string.plan_change_full_course else R.string.plan_change_ends_at_exam)
        }

        is PlanOp.BaseChoices -> {
            baseChoicesSentence(op.choices)
        }

        is PlanOp.FocusAreas -> {
            if (op.areas.isEmpty()) {
                stringResource(
                    R.string.plan_change_no_focus,
                )
            } else {
                stringResource(R.string.plan_change_more_time_for, focusNames(op))
            }
        }

        is PlanOp.ReduceAreas -> {
            stringResource(R.string.plan_change_less_time_for, joinList(op.areas))
        }

        is PlanOp.SkipAreas -> {
            stringResource(
                if (op.areas.size ==
                    1
                ) {
                    R.string.plan_change_area_left_out
                } else {
                    R.string.plan_change_areas_left_out_many
                },
                joinList(op.areas),
            )
        }

        is PlanOp.RestoreAreas -> {
            stringResource(R.string.plan_change_topics_added, joinList(op.areas))
        }

        is PlanOp.AreaStart -> {
            stringResource(
                when {
                    op.pastBasics -> R.string.plan_change_start_past_basics
                    op.areas.size == 1 -> R.string.plan_change_area_from_basics
                    else -> R.string.plan_change_areas_from_basics
                },
                joinList(op.areas),
            )
        }

        PlanOp.Unknown -> {
            stringResource(R.string.plan_change_changed)
        }
    }

@Composable
private fun dateStatement(
    date: LocalDate,
    dateKind: GoalDateKind,
): String =
    stringResource(
        when (dateKind) {
            GoalDateKind.Exam -> R.string.plan_change_exam_date
            GoalDateKind.Goal -> R.string.plan_change_end_date
            GoalDateKind.Unknown -> R.string.plan_change_date_moved
        },
        longDate(date),
    )

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
    ).let { stringResource(R.string.plan_change_bases, joinList(it)) }
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

/** Main's `useSystemChangeSentence`: a change the plan made by itself says why in one sentence; what moved is its effect. */
@Composable
private fun systemChangeSentence(change: PlanChange): String? {
    val effect = change.effect
    return when (change.kind) {
        "missedDays" -> {
            stringResource(R.string.plan_change_missed_days)
        }

        "estimateUpdated" -> {
            if (effect != null &&
                effect.lessonsAdded != effect.lessonsRemoved
            ) {
                stringResource(R.string.plan_change_estimate_updated)
            } else {
                null
            }
        }

        "testedOut" -> {
            val lessons = change.lessonsSkipped.toInt()
            pluralStringResource(R.plurals.plan_change_tested_out, lessons, lessons)
        }

        "relearn" -> {
            relearnSentence(effect)
        }

        "coverageChanged" -> {
            stringResource(if (effect?.fromPlacement == true) R.string.plan_change_from_test else R.string.plan_change_changed)
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

/** Main's `usePhaseDatesQuestion`: one thing moves, which, and why in the learner's terms; the moved dates are the change's effect. */
@Composable
private fun phaseDatesQuestion(effect: PlanEffect?): ChangeWords {
    val moves = effect?.phaseEnds.orEmpty()
    val late = moves.filter { it.lessonsFirst == true }
    val resting = moves.filter { it.restDay == true }
    val first = late.firstOrNull()
    val rest = resting.firstOrNull()
    return when {
        late.size > 1 -> {
            ChangeWords(stringResource(R.string.plan_ask_phase_dates_later), stringResource(R.string.plan_why_phase_dates_later))
        }

        first != null -> {
            val days = ChronoUnit.DAYS.between(first.before.toJavaLocalDate(), first.after.toJavaLocalDate()).toInt()
            ChangeWords(
                pluralStringResource(R.plurals.plan_ask_phase_end_later, days, first.name, days),
                stringResource(R.string.plan_why_phase_end_later),
            )
        }

        resting.size > 1 -> {
            ChangeWords(stringResource(R.string.plan_ask_phase_dates_off_rest), null)
        }

        rest != null -> {
            val day =
                weekdayName(
                    rest.before
                        .toJavaLocalDate()
                        .dayOfWeek.value % 7,
                )
            ChangeWords(
                stringResource(R.string.plan_ask_phase_end_off_rest, rest.name, day),
                stringResource(R.string.plan_why_phase_end_off_rest, day.replaceFirstChar { it.titlecase(currentLocale()) }),
            )
        }

        else -> {
            ChangeWords(stringResource(R.string.plan_ask_phase_dates), null)
        }
    }
}

/**
 * Main's `useLessonsEffectText`: lessons added and left out. Without a date the plan keeps every
 * lesson, so it has fewer or more of them, never "left out". When names aren't one per lesson, a
 * few are examples ("such as A, B and C"). Beside a diff ([named]), which counts them first, only a
 * sentence naming the lessons left out says more.
 */
@Composable
fun lessonsText(
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
        return listOfNotNull(left, unwritten).joinSentences().ifEmpty { null }
    }

    val counts = lessonCounts(added, about, removed, names, someOf, byDate)
    // Counts net skill by skill, so a lesson swapped within its skill still needs its name.
    val netted =
        if (removed == 0 && leftOut.isNotEmpty()) {
            lessonCounts(0, false, leftOut.size, shortList(leftOut, ListKind.Lessons), someOf = false, byDate = true)
        } else {
            null
        }
    return listOfNotNull(counts, netted, unwritten).joinSentences().ifEmpty { null }
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
