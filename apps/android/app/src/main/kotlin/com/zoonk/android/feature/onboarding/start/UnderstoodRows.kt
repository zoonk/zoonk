package com.zoonk.android.feature.onboarding.start

import android.content.res.Resources
import android.icu.text.ListFormatter
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.api.models.GoalDraftOutput
import com.zoonk.api.models.GoalUnderstandingOneOfSchedule
import com.zoonk.api.models.OnboardingExamDate
import com.zoonk.api.models.TargetCutoff
import com.zoonk.api.models.UnderstoodGoal
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.text.Normalizer
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.Locale

enum class EditorKind { Text, Date, Time }

enum class EditableField(
    val key: String,
    val kind: EditorKind,
) {
    Title("title", EditorKind.Text),
    TargetDate("targetDate", EditorKind.Date),
    Institution("institution", EditorKind.Text),
    Reason("reason", EditorKind.Text),
    Role("role", EditorKind.Text),
    TargetCourse("targetCourse", EditorKind.Text),
    TargetPosition("targetPosition", EditorKind.Text),
    TargetScore("targetScore", EditorKind.Text),
    StudyTime("studyTime", EditorKind.Time),
}

data class RowSource(
    val title: String?,
    val url: String,
)

data class UnderstoodRow(
    val id: String,
    val label: String,
    val value: String,
    val badge: String? = null,
    val note: String? = null,
    val source: RowSource? = null,
    val editable: EditableField? = null,
    /** What the editor starts with when the fact has no value of its own yet. */
    val editDefault: String? = null,
    val editLabel: String? = null,
    /** Offered with one tap, never put in place of the learner's date. */
    val suggestedDate: LocalDate? = null,
    val choiceDates: List<LocalDate> = emptyList(),
)

class UnderstoodRows(
    private val resources: Resources,
    private val locale: Locale,
    private val is24Hour: Boolean,
    private val today: LocalDate = LocalDate.now(),
) {
    private fun text(
        id: Int,
        vararg args: Any,
    ) = resources.getString(id, *args)

    fun rows(goal: UnderstoodGoal): List<UnderstoodRow> {
        val draft = goal.draft
        val levelNote = draft.details.text("levelNote")

        return listOfNotNull(
            UnderstoodRow("title", text(R.string.onboarding_row_goal), draft.title, editable = EditableField.Title),
            dateRow(draft, goal.examDates),
        ) + languageRows(draft) + detailRows(draft, goal.cutoff) +
            listOfNotNull(
                levelNote?.let {
                    UnderstoodRow(
                        "level",
                        text(R.string.onboarding_row_level),
                        it,
                        badge = text(R.string.onboarding_row_you_said),
                    )
                },
            )
    }

    /** Whether the learner gave a time a day: otherwise the default isn't shown as theirs. */
    fun scheduleRow(
        schedule: GoalUnderstandingOneOfSchedule,
        minutesSaid: Boolean,
    ): UnderstoodRow? {
        val time = schedule.studyTime?.let(::parseTime)
        val whenStudied = schedule.studyTimeNote ?: time?.let { formatTimeOfDay(it, locale, is24Hour) }
        val parts =
            listOfNotNull(
                whenStudied,
                if (minutesSaid) {
                    text(
                        R.string.onboarding_row_minutes_a_day,
                        formatMinutes(schedule.dailyMinutes.toInt(), locale),
                    )
                } else {
                    null
                },
            )
        if (parts.isEmpty()) return null

        return UnderstoodRow(
            id = "schedule",
            label = text(R.string.onboarding_row_when_you_study),
            value = parts.joinToString(" · "),
            editable = EditableField.StudyTime,
            editDefault = schedule.studyTime.orEmpty(),
        )
    }

    fun materialRow(material: List<String>): UnderstoodRow? =
        material.takeIf { it.isNotEmpty() }?.let { titles ->
            UnderstoodRow(
                id = "material",
                label = text(R.string.onboarding_row_material),
                value = titles.joinToString(", ") { it.ifBlank { text(R.string.onboarding_your_text) } },
                note = text(R.string.onboarding_row_material_note),
            )
        }

    private fun languageRows(draft: GoalDraftOutput): List<UnderstoodRow> {
        val target = draft.targetLanguage
        if (draft.kind != GoalDraftOutput.Kind.LANGUAGE || target == null) return emptyList()
        val language = languageName(target)
        val native = draft.details.text("nativeLanguage") ?: draft.language

        return listOfNotNull(
            UnderstoodRow(
                "targetLanguage",
                text(R.string.onboarding_row_language),
                language,
            ).takeUnless { isSaidIn(draft.title, language) },
            UnderstoodRow("nativeLanguage", text(R.string.onboarding_row_you_speak), languageName(native)),
        )
    }

    private fun detailRows(
        draft: GoalDraftOutput,
        cutoff: TargetCutoff?,
    ): List<UnderstoodRow> {
        fun unsaid(key: String) = draft.details.text(key)?.takeUnless { isSaidIn(draft.title, it) }

        val course = unsaid("targetCourse")
        val institution = unsaid("institution")
        val target = unsaid("targetScore")
        val position = unsaid("targetPosition")
        val reason = unsaid("reason")
        val role = unsaid("role")
        val careerChange = (draft.details?.get("purpose") as? JsonPrimitive)?.contentOrNull == "careerChange"

        return listOfNotNull(
            course?.let {
                UnderstoodRow(
                    id = "targetCourse",
                    label = text(R.string.onboarding_row_course),
                    value = it,
                    // A label, not "at {institution}": the preposition's article depends on the name ("na USP").
                    note = institution?.let { place -> text(R.string.onboarding_row_where_note, place) },
                    editable = EditableField.TargetCourse,
                )
            },
            institution?.takeIf { course == null }?.let {
                UnderstoodRow("institution", text(R.string.onboarding_row_where), it, editable = EditableField.Institution)
            },
            position?.let {
                UnderstoodRow(
                    id = "targetPosition",
                    label = text(if (careerChange) R.string.onboarding_row_role_you_want else R.string.onboarding_row_position),
                    value = it,
                    editable = EditableField.TargetPosition,
                )
            },
            target?.let {
                UnderstoodRow(
                    id = "targetScore",
                    label =
                        text(
                            if (draft.kind ==
                                GoalDraftOutput.Kind.LANGUAGE
                            ) {
                                R.string.onboarding_row_level_aiming
                            } else {
                                R.string.onboarding_row_target_score
                            },
                        ),
                    value = it,
                    editable = EditableField.TargetScore,
                )
            },
            cutoff?.let(::cutoffRow),
            reason?.let { UnderstoodRow("reason", text(R.string.onboarding_row_reason), it, editable = EditableField.Reason) },
            role?.let {
                UnderstoodRow(
                    id = "role",
                    label = text(if (careerChange) R.string.onboarding_row_what_you_do else R.string.onboarding_row_your_role),
                    value = it,
                    editable = EditableField.Role,
                )
            },
        )
    }

    /** Named by its site: a search's page titles are often file names ("Notas-minimas.pdf"). */
    private fun cutoffRow(cutoff: TargetCutoff): UnderstoodRow {
        fun number(value: Double) = formatNumber(value, locale, maximumFractionDigits = 1)
        val detail =
            listOf(cutoff.course, cutoff.position, cutoff.institution.takeIf { cutoff.course != null }, cutoff.edition, cutoff.quota)
                .filterNot { it.isNullOrBlank() }
                .joinToString(" · ")
        return UnderstoodRow(
            id = "cutoff",
            label = text(R.string.onboarding_row_last_cutoff),
            value = text(R.string.onboarding_row_cutoff_score, number(cutoff.score), number(cutoff.maxScore)),
            note = detail.ifBlank { null },
            source = RowSource(title = null, url = cutoff.source.url),
        )
    }

    private fun dateRow(
        draft: GoalDraftOutput,
        examDates: List<OnboardingExamDate>,
    ): UnderstoodRow? {
        draft.targetDate?.let { return ownDateRow(draft, examDates, it.toJavaLocalDate()) }
        if (draft.kind != GoalDraftOutput.Kind.EXAM) return null

        val first =
            examDates.firstOrNull()
                ?: return UnderstoodRow(
                    id = "targetDate",
                    label = text(R.string.onboarding_row_exam_date),
                    value = toBeConfirmed(ExamSittings.examMonth(draft.details), examYear(draft, examDates)),
                    note =
                        text(
                            if (isGuide(draft)) R.string.onboarding_row_date_not_out_guide else R.string.onboarding_row_date_not_out_notice,
                        ),
                    editable = EditableField.TargetDate,
                )

        val estimated = examDates.any { it.estimated }
        if (!estimated) (keptMonthRow(draft, examDates) ?: sittingChoiceRow(draft, examDates))?.let { return it }

        val sitting =
            if (estimated) {
                examDates
            } else {
                ExamSittings.learnerSitting(examDates, today, ExamSittings.namedMonthStart(draft.details, today)) ?: examDates
            }
        val day = sitting.firstOrNull() ?: first

        return UnderstoodRow(
            id = "examDates",
            label = resources.getQuantityString(R.plurals.onboarding_row_exam_dates, sitting.size),
            value = examDaysText(sitting),
            note = if (estimated) text(R.string.onboarding_row_dates_estimated) else daysLeft(day.day),
            source = if (estimated) null else day.source?.let { RowSource(it.title, it.url) },
            editable = EditableField.TargetDate,
            editDefault = day.day.toString(),
            editLabel = text(R.string.onboarding_row_exam_date),
        )
    }

    private fun ownDateRow(
        draft: GoalDraftOutput,
        examDates: List<OnboardingExamDate>,
        targetDate: LocalDate,
    ): UnderstoodRow {
        val official = examDates.find { it.source != null && !it.estimated && it.day == targetDate }
        val suggested =
            if (official != null) {
                null
            } else {
                ExamSittings
                    .meantDay(examDates, draft.details, today, targetDate)
                    ?.takeUnless { day -> day.estimated || examDates.any { it.day == targetDate } }
            }
        val note = official?.let { daysLeft(it.day) } ?: suggested?.let { noticeDayText(it.day, draft) }

        return UnderstoodRow(
            id = "targetDate",
            label =
                text(
                    if (draft.kind ==
                        GoalDraftOutput.Kind.EXAM
                    ) {
                        R.string.onboarding_row_exam_date
                    } else {
                        R.string.onboarding_row_deadline
                    },
                ),
            value = formatDate(targetDate, locale, DateStyle.LongYear, today),
            note = note,
            source = (official ?: suggested)?.source?.let { RowSource(it.title, it.url) },
            editable = EditableField.TargetDate,
            suggestedDate = suggested?.day,
        )
    }

    private fun keptMonthRow(
        draft: GoalDraftOutput,
        examDates: List<OnboardingExamDate>,
    ): UnderstoodRow? {
        val noticeDay = ExamSittings.meantDay(examDates, draft.details, today, goalDate = null)
        val kept =
            (
                if (noticeDay != null) {
                    ExamSittings.keptMonthStart(draft.details, noticeDay.day, today)
                } else {
                    ExamSittings.namedMonthStart(draft.details, today)
                }
            ) ?: return null

        return UnderstoodRow(
            id = "targetDate",
            label = text(R.string.onboarding_row_exam_date),
            value = formatDate(kept, locale, DateStyle.Month, today).replaceFirstChar { it.titlecase(locale) },
            note = noticeDay?.let { noticeDayText(it.day, draft) },
            source = noticeDay?.source?.let { RowSource(it.title, it.url) },
            editable = EditableField.TargetDate,
            editDefault = kept.toString(),
            suggestedDate = noticeDay?.day,
        )
    }

    /** Until the learner picks, the plan counts down to the first sitting. */
    private fun sittingChoiceRow(
        draft: GoalDraftOutput,
        examDates: List<OnboardingExamDate>,
    ): UnderstoodRow? {
        val open = ExamSittings.openSittings(SITTING_CHOICES, examDates, today)
        val first = open.firstOrNull()
        if (ExamSittings.examMonth(draft.details) != null || !ExamSittings.hasSeveral(examDates) || first == null ||
            open.size < 2
        ) {
            return null
        }

        return UnderstoodRow(
            id = "examDates",
            label = text(R.string.onboarding_row_exam_date),
            value = text(R.string.onboarding_row_pick_date),
            note = text(R.string.onboarding_row_several_sittings),
            source = first.source?.let { RowSource(it.title, it.url) },
            editable = EditableField.TargetDate,
            editDefault = first.day.toString(),
            editLabel = text(R.string.onboarding_row_exam_date),
            choiceDates = open.map { it.day },
        )
    }

    private fun noticeDayText(
        date: LocalDate,
        draft: GoalDraftOutput,
    ) = text(
        if (isGuide(draft)) R.string.onboarding_row_guide_says else R.string.onboarding_row_notice_says,
        formatDate(date, locale, DateStyle.Long, today),
    )

    private fun daysLeft(date: LocalDate): String {
        val days = ChronoUnit.DAYS.between(today, date).toInt()
        return resources.getQuantityString(R.plurals.onboarding_row_days_left, days, days)
    }

    private fun toBeConfirmed(
        month: Int?,
        year: Int?,
    ): String =
        when {
            year == null -> {
                text(R.string.onboarding_row_to_be_confirmed)
            }

            month == null -> {
                text(R.string.onboarding_row_year_to_be_confirmed, formatNumber(year.toDouble(), locale, grouping = false))
            }

            else -> {
                text(R.string.onboarding_row_date_to_be_confirmed, formatDate(LocalDate.of(year, month, 1), locale, DateStyle.Month, today))
            }
        }

    private fun examYear(
        draft: GoalDraftOutput,
        dates: List<OnboardingExamDate>,
    ) = ExamSittings.examYear(draft.details) ?: dates.firstOrNull()?.day?.year

    private fun examDaysText(days: List<OnboardingExamDate>): String {
        val sameYear = days.map { it.day.year }.distinct().size == 1
        return ListFormatter.getInstance(locale).format(
            days.mapIndexed { index, day ->
                val style = if (sameYear && index < days.lastIndex) DateStyle.DayMonth else DateStyle.LongYear
                formatDate(day.day, locale, style, today).replace(' ', NO_BREAK_SPACE)
            },
        )
    }

    private fun languageName(tag: String): String =
        Locale.forLanguageTag(tag).getDisplayLanguage(locale).replaceFirstChar {
            it.titlecase(locale)
        }

    private companion object {
        const val SITTING_CHOICES = 3
        const val NO_BREAK_SPACE = ' '
    }
}

/** A language certificate's dates come from its official guide, any other exam's from its notice. */
private fun isGuide(draft: GoalDraftOutput) = draft.kind == GoalDraftOutput.Kind.EXAM && draft.targetLanguage != null

/** Whether the learner said the schedule's time a day themselves. */
internal fun minutesSaid(goal: UnderstoodGoal?): Boolean =
    (goal?.draft?.details?.get("answered") as? JsonArray)?.any { (it as? JsonPrimitive)?.contentOrNull == "schedule" } == true

internal fun Map<String, JsonElement>?.text(key: String): String? =
    (this?.get(key) as? JsonPrimitive)
        ?.takeIf {
            it.isString
        }?.content
        ?.takeIf { it.isNotBlank() }

/** Main's `isSaidInTitle`: as whole words, ignoring accents and case, so "dev" isn't said in "development". */
internal fun isSaidIn(
    title: String,
    value: String,
): Boolean {
    val words = words(value)
    return words.isNotBlank() && words(title).contains(words)
}

private fun words(text: String): String {
    val plain = Normalizer.normalize(text, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()
    return " " + plain.replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim() + " "
}

private fun parseTime(value: String): LocalTime? =
    try {
        LocalTime.parse(value)
    } catch (e: java.time.format.DateTimeParseException) {
        null
    }
