package com.zoonk.android.feature.plan

import android.icu.math.BigDecimal
import android.icu.text.NumberFormat
import android.icu.util.ULocale
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.language.CanDoList
import com.zoonk.android.feature.language.LevelValue
import com.zoonk.android.feature.language.SkillLevelsCard
import com.zoonk.android.feature.language.skillName
import com.zoonk.android.feature.speaking.SpeakingMockCard
import com.zoonk.android.feature.speaking.SpeakingPracticeRow
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.weekdayNames
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.EstimatedScore
import com.zoonk.api.models.GoalPreparation
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.GoalProgressStillNeeded
import com.zoonk.api.models.LanguageSkillLevel
import com.zoonk.api.models.PlanDay
import com.zoonk.api.models.PlanItem
import com.zoonk.api.models.PreparationComponentsMocks
import com.zoonk.api.models.SpeakingPaper
import kotlinx.datetime.toJavaLocalDate
import java.util.Locale
import kotlin.math.min
import kotlin.math.roundToInt

enum class NumberVariant { Tiles, Stats }

private data class PlanNumber(
    val label: String,
    val value: String,
    val detail: String?,
    val share: Float? = null,
    val numeric: Boolean = true,
    val target: String? = null,
)

private enum class NumberSheet { Standing, Pace }

@Composable
internal fun PlanNumbers(
    page: PlanPageState,
    standing: Standing?,
    variant: NumberVariant,
    links: PlanLinks,
    modifier: Modifier = Modifier,
    onAdjust: (() -> Unit)? = null,
) {
    var open by rememberSaveable { mutableStateOf<NumberSheet?>(null) }
    val pace = page.plan.status?.pace
    val gap = if (variant == NumberVariant.Tiles) 8.dp else 24.dp
    if (standing == null && pace == null) return

    Row(modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
        if (standing != null) {
            NumberButton(standingNumber(standing), variant, Modifier.weight(1f)) { open = NumberSheet.Standing }
        }
        if (pace != null) {
            NumberButton(paceNumber(page, pace), variant, Modifier.weight(1f)) { open = NumberSheet.Pace }
        }
    }

    when (open) {
        NumberSheet.Standing -> {
            if (standing == null) return
            DetailsSheet(standingTitle(standing), onDismiss = { open = null }) {
                when (standing) {
                    is Standing.Preparation -> PreparationDetails(standing.progress, forExam = true, lessons = null, links = links)
                    is Standing.Progress -> PreparationDetails(standing.progress, forExam = false, lessons = standing, links = links)
                    is Standing.Language -> LanguageDetails(standing, links.closing { open = null })
                }
            }
        }

        NumberSheet.Pace -> {
            if (pace != null) {
                DetailsSheet(stringResource(R.string.plan_your_pace), onDismiss = { open = null }) {
                    PaceDetails(
                        page = page,
                        pace = pace,
                        links = links,
                        onAdjust =
                            onAdjust?.let {
                                {
                                    open = null
                                    it()
                                }
                            },
                    )
                }
            }
        }

        null -> {}
    }
}

@Composable
private fun standingTitle(standing: Standing) =
    stringResource(
        when (standing) {
            is Standing.Preparation -> R.string.plan_your_preparation
            is Standing.Progress -> R.string.plan_your_progress
            is Standing.Language -> R.string.plan_your_level
        },
    )

@Composable
private fun standingNumber(standing: Standing): PlanNumber {
    val locale = currentLocale()
    return when (standing) {
        is Standing.Preparation -> {
            val preparation = standing.progress.preparation
            val value = preparation?.value ?: 0.0
            PlanNumber(
                label = stringResource(R.string.plan_preparation),
                value = formatPercent(value, locale),
                detail = weekGain(preparation?.weekGain ?: 0.0),
                share = value.toFloat(),
            )
        }

        is Standing.Progress -> {
            val share = if (standing.total > 0) min(1f, standing.done.toFloat() / standing.total) else 0f
            PlanNumber(
                label = stringResource(R.string.plan_progress),
                value = formatGoalProgress(share.toDouble(), locale),
                detail =
                    pluralStringResource(
                        R.plurals.plan_lessons_of,
                        standing.total.toInt(),
                        standing.done.toInt(),
                        standing.total.toInt(),
                    ),
                share = share,
            )
        }

        is Standing.Language -> {
            val language = standing.progress
            PlanNumber(
                label = stringResource(R.string.plan_level),
                value = language.level ?: stringResource(R.string.plan_not_yet),
                detail =
                    when (val lead = skillLead(language.levels)) {
                        SkillLead.Even -> stringResource(R.string.plan_even_across_skills)
                        is SkillLead.Leads -> stringResource(R.string.plan_skill_leads, skillName(lead.skill))
                        null -> null
                    },
                numeric = language.level != null,
                target = language.target?.label,
            )
        }
    }
}

internal sealed interface SkillLead {
    data object Even : SkillLead

    data class Leads(
        val skill: LanguageSkillLevel.Skill,
    ) : SkillLead
}

/** The highest skill, when one is ahead of the others; none when the highest are tied. */
internal fun skillLead(levels: List<LanguageSkillLevel>): SkillLead? {
    val sorted = levels.sortedByDescending { it.score }
    val first = sorted.firstOrNull() ?: return null
    val rest = sorted.drop(1)
    return when {
        rest.all { it.score == first.score } -> SkillLead.Even
        rest.first().score == first.score -> null
        else -> SkillLead.Leads(first.skill)
    }
}

@Composable
private fun weekGain(gain: Double): String {
    val points = (gain * PERCENT).roundToInt()
    return when {
        points == 0 -> stringResource(R.string.plan_no_change_this_week)
        points > 0 -> pluralStringResource(R.plurals.plan_gain_this_week, points, points)
        else -> pluralStringResource(R.plurals.plan_loss_this_week, -points, points)
    }
}

private const val PERCENT = 100

/** Main's goal progress: a percent with up to two decimals, so a small step still moves it. */
private fun formatGoalProgress(
    share: Double,
    locale: Locale,
): String =
    NumberFormat
        .getPercentInstance(ULocale.forLocale(locale))
        .apply {
            maximumFractionDigits = 2
            roundingMode = BigDecimal.ROUND_HALF_UP
        }.format(share)

@Composable
private fun paceNumber(
    page: PlanPageState,
    pace: Pace,
): PlanNumber {
    val (value, detail) =
        when {
            pace is Pace.Finished -> {
                R.string.plan_pace_value_finished to null
            }

            pace is Pace.PastDate -> {
                R.string.plan_pace_value_past_date to pluralStringResource(R.plurals.plan_lessons_left, pace.lessons, pace.lessons)
            }

            pace is Pace.ChallengesLeft -> {
                R.string.plan_pace_value_challenges to paceText(pace)
            }

            page.isPaused -> {
                R.string.plan_pace_value_paused to stringResource(R.string.plan_nothing_planned)
            }

            pace is Pace.Ahead -> {
                R.string.plan_pace_value_ahead to paceText(pace)
            }

            pace is Pace.Behind -> {
                R.string.plan_pace_value_behind to paceText(pace)
            }

            pace is Pace.NeedsAdjusting -> {
                R.string.plan_pace_value_too_tight to paceText(pace)
            }

            else -> {
                val time =
                    formatMinutes(
                        page.plan.schedule.dailyMinutes
                            .toInt(),
                        currentLocale(),
                    )
                R.string.plan_pace_value_on_pace to stringResource(R.string.plan_time_a_day, time)
            }
        }
    return PlanNumber(stringResource(R.string.plan_pace), stringResource(value), detail, numeric = false)
}

@Composable
private fun NumberButton(
    number: PlanNumber,
    variant: NumberVariant,
    modifier: Modifier,
    onOpen: () -> Unit,
) {
    val content: @Composable ColumnScope.() -> Unit = {
        Text(
            text = number.label,
            style = if (variant == NumberVariant.Tiles) MaterialTheme.typography.labelLarge else MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        val style =
            MaterialTheme.typography.headlineMedium.let {
                if (number.numeric) it.withTabularFigures() else it.copy(fontWeight = FontWeight.SemiBold)
            }
        val target = number.target
        if (target == null) Text(number.value, style = style) else LevelValue(number.value, target, style)
        number.share?.let { Meter(it, Modifier.padding(vertical = 2.dp)) }
        number.detail?.let { MetaLine(it) }
    }

    if (variant == NumberVariant.Tiles) {
        OutlinedCard(
            onClick = onOpen,
            modifier = modifier.fillMaxHeight(),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
        }
    } else {
        Column(
            modifier =
                modifier
                    .bleed(LIST_ITEM_INSET)
                    .clickable(role = Role.Button, onClick = onOpen)
                    .padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailsSheet(
    title: String,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            content()
        }
    }
}

@Composable
internal fun PaceDetails(
    page: PlanPageState,
    pace: Pace,
    links: PlanLinks,
    onAdjust: (() -> Unit)?,
) {
    val resting = page.isPaused && pace !is Pace.Finished && pace !is Pace.PastDate && pace !is Pace.ChallengesLeft
    val fix = if (resting) null else paceFix(pace, page.isExam)

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = if (resting) stringResource(R.string.plan_pace_value_paused) else paceText(pace),
            style = MaterialTheme.typography.titleMedium,
        )
        if (resting) MetaLine(stringResource(R.string.plan_nothing_planned_until_resume))
        fix?.let { MetaLine(it.text) }
        if (fix?.adjust == true && onAdjust != null) {
            FilledTonalButton(
                onClick = onAdjust,
                modifier = Modifier.padding(top = 4.dp),
            ) { Text(stringResource(R.string.plan_adjust_plan)) }
        }
    }

    PlanWeek(page)

    ListRow(
        headline = { Text(stringResource(R.string.plan_last_week_recap)) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = links::logbook,
    )
}

@Composable
private fun PlanWeek(page: PlanPageState) {
    val locale = currentLocale()
    val time = page.plan.weekTime
    val days = page.plan.week.days

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = stringResource(R.string.plan_this_week),
                modifier = Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (time.targetMinutes > 0) {
                Text(
                    text =
                        stringResource(
                            R.string.plan_week_time,
                            formatMinutes(time.studiedMinutes.toInt(), locale),
                            formatMinutes(time.targetMinutes.roundToInt(), locale),
                        ),
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Row(Modifier.fillMaxWidth()) {
            days.forEach { day ->
                val date = day.date.toJavaLocalDate()
                val spoken =
                    stringResource(R.string.plan_week_day, weekdayNames(locale).full.getValue(date.dayOfWeek), dayStatus(day.state))
                Column(
                    modifier = Modifier.weight(1f).padding(vertical = 4.dp).clearAndSetSemantics { contentDescription = spoken },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = weekdayNames(locale).narrow.getValue(date.dayOfWeek),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    DayRing(day)
                }
            }
        }
    }
}

@Composable
private fun dayStatus(state: PlanDay.State): String =
    stringResource(
        when (state) {
            PlanDay.State.DONE -> R.string.plan_day_done
            PlanDay.State.MISSED -> R.string.plan_day_missed
            PlanDay.State.REST -> R.string.plan_day_rest
            PlanDay.State.TODAY -> R.string.plan_day_today
            PlanDay.State.UPCOMING -> R.string.plan_day_planned
        },
    )

private val PlanItem.isDone: Boolean get() = status == PlanItem.Status.DONE || status == PlanItem.Status.TESTED_OUT

@Composable
private fun DayRing(day: PlanDay) {
    val ink = MaterialTheme.colorScheme.onSurface
    val fill = MaterialTheme.colorScheme.tertiary
    val share =
        when {
            day.state == PlanDay.State.DONE -> 1f
            day.items.isNotEmpty() -> day.items.count { it.isDone }.toFloat() / day.items.size
            else -> 0f
        }
    val trackAlpha =
        when (day.state) {
            PlanDay.State.REST -> 0.06f
            PlanDay.State.MISSED, PlanDay.State.TODAY -> 0.25f
            else -> 0.1f
        }

    val ring = markSize() * DAY_RING_SHARE
    Box(Modifier.size(ring), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(ring)) {
            val width = 3.dp.toPx()
            val inset = width / 2
            val arcSize = Size(size.width - width, size.height - width)
            val dashes =
                if (day.state ==
                    PlanDay.State.MISSED
                ) {
                    PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.3.dp.toPx()))
                } else {
                    null
                }
            drawArc(
                ink.copy(alpha = trackAlpha),
                0f,
                360f,
                false,
                Offset(inset, inset),
                arcSize,
                style = Stroke(width, pathEffect = dashes),
            )
            if (share >
                0
            ) {
                drawArc(fill, -90f, 360f * share, false, Offset(inset, inset), arcSize, style = Stroke(width, cap = StrokeCap.Round))
            }
        }
        if (day.state == PlanDay.State.DONE) DoneMark()
    }
}

@Composable
internal fun LanguageDetails(
    standing: Standing.Language,
    links: PlanLinks,
) {
    val language = standing.progress
    SkillLevelsCard(language)
    CanDoList(language.canDo)
    language.speaking?.let { paper ->
        SpeakingPracticeRow(
            paper.title,
            paper.access == SpeakingPaper.Access.PLUS_REQUIRED,
            onOpen = links::speaking,
            modifier = Modifier.bleed(LIST_ITEM_INSET),
        )
    }
    language.speakingMock?.let { exam ->
        SpeakingMockCard(exam, language.goal.id, language.speakingMockPaused, start = standing.startCall, open = links::open)
    }
}

@Composable
internal fun PreparationDetails(
    progress: GoalProgress,
    forExam: Boolean,
    lessons: Standing.Progress?,
    links: PlanLinks,
) {
    val preparation = progress.preparation ?: return
    if (forExam) EstimatedScoreBlock(preparation)
    PreparationParts(preparation, forExam, lessons)
    StillToDo(preparation, progress.stillNeeded, links)
}

@Composable
private fun EstimatedScoreBlock(preparation: GoalPreparation) {
    val score = preparation.estimatedScore
    val mocks = preparation.components.mocks
    if (score == null) {
        if (mocks.kind == PreparationComponentsMocks.Kind.MOCK_EXAMS && mocks.taken > 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KindMark(LearnKind.Mock)
                MetaLine(stringResource(R.string.plan_estimate_waits))
            }
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.plan_estimated_score),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(scoreRange(score), style = MaterialTheme.typography.headlineMedium.withTabularFigures())
        val mocks = score.mocks.toInt()
        MetaLine(
            if (mocks ==
                1
            ) {
                stringResource(R.string.plan_estimate_based_on_last)
            } else {
                pluralStringResource(R.plurals.plan_estimate_based_on, mocks, mocks)
            },
        )
    }
}

/** Always a range, so it never reads as a promise; whole-number scales as their reports print them. */
@Composable
private fun scoreRange(score: EstimatedScore): String {
    val locale = currentLocale()
    val single = score.low == score.high
    // Whole-number scales read as their score reports print them: "1170", never "1,170".
    val grouping = score.scale == EstimatedScore.Scale.PERCENT || score.scale == EstimatedScore.Scale.TOEFL
    val low = formatNumber(score.low, locale, grouping = grouping)
    val high = formatNumber(score.high, locale, grouping = grouping)
    return when (score.scale) {
        EstimatedScore.Scale.PERCENT -> {
            if (single) stringResource(R.string.plan_score_percent, low) else stringResource(R.string.plan_score_percent_range, low, high)
        }

        EstimatedScore.Scale.TOEFL -> {
            if (single) stringResource(R.string.plan_score_band, low) else stringResource(R.string.plan_score_band_range, low, high)
        }

        else -> {
            if (single) low else stringResource(R.string.plan_score_range, low, high)
        }
    }
}

private data class PreparationPart(
    val label: String,
    val caption: String,
    val value: Double?,
)

@Composable
private fun PreparationParts(
    preparation: GoalPreparation,
    forExam: Boolean,
    lessons: Standing.Progress?,
) {
    val locale = currentLocale()
    val components = preparation.components
    val notYet = stringResource(R.string.plan_not_yet)
    val first =
        if (!forExam && lessons != null) {
            PreparationPart(
                stringResource(R.string.plan_lessons),
                pluralStringResource(R.plurals.plan_lessons_of, lessons.total.toInt(), lessons.done.toInt(), lessons.total.toInt()),
                if (lessons.total > 0) min(1.0, lessons.done.toDouble() / lessons.total) else 0.0,
            )
        } else {
            PreparationPart(
                stringResource(R.string.plan_coverage),
                pluralStringResource(
                    R.plurals.plan_coverage_caption,
                    components.coverage.totalSkills.toInt(),
                    components.coverage.studiedSkills.toInt(),
                    components.coverage.totalSkills.toInt(),
                ),
                components.coverage.value,
            )
        }
    val mastery = components.mastery
    val retention = components.retention
    val mocks = components.mocks
    val taken = mocks.taken.toInt()
    val (testLabel, testCaption) =
        when (mocks.kind) {
            PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
                stringResource(R.string.plan_full_reviews) to pluralStringResource(R.plurals.plan_full_reviews_done, taken, taken)
            }

            PreparationComponentsMocks.Kind.WEEKLY_CHALLENGES -> {
                stringResource(R.string.plan_weekly_challenges) to
                    pluralStringResource(R.plurals.plan_weekly_challenges_count, taken, taken)
            }

            PreparationComponentsMocks.Kind.MOCK_EXAMS -> {
                stringResource(R.string.plan_mock_exams) to pluralStringResource(R.plurals.plan_mock_exams_taken, taken, taken)
            }
        }
    val parts =
        listOf(
            first,
            PreparationPart(
                stringResource(R.string.plan_mastery),
                if (mastery.value ==
                    null
                ) {
                    stringResource(R.string.plan_mastery_waits)
                } else {
                    pluralStringResource(
                        R.plurals.plan_mastery_caption,
                        mastery.answered.toInt(),
                        mastery.correct.toInt(),
                        mastery.answered.toInt(),
                    )
                },
                // The headline's measure: a few right answers say less than many.
                mastery.supported,
            ),
            PreparationPart(
                stringResource(R.string.plan_long_term_memory),
                if (retention.value == null) notYet else stringResource(R.string.plan_retention_caption),
                retention.value,
            ),
            PreparationPart(testLabel, if (taken == 0) notYet else testCaption, mocks.value),
        )

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        TwoColumnsWhenWordsFit {
            parts.forEach { part ->
                val value = part.value?.let { formatPercent(it, locale) }
                Row(
                    modifier = Modifier.semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PartRing(part.value, value)
                    Column {
                        Text(part.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        MetaLine(part.caption)
                    }
                }
            }
        }
        MetaLine(
            when {
                !forExam -> {
                    stringResource(R.string.plan_measure_progress)
                }

                preparation.components.mocks.kind == PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
                    stringResource(
                        R.string.plan_measure_full_reviews,
                    )
                }

                else -> {
                    stringResource(R.string.plan_measure_mocks)
                }
            },
        )
    }
}

/** Two parts a row only while each part's words fit its half unbroken; one a row otherwise. */
@Composable
private fun TwoColumnsWhenWordsFit(content: @Composable () -> Unit) {
    Layout(content) { measurables, constraints ->
        val gap = PART_GAP.roundToPx()
        val half = (constraints.maxWidth - gap) / 2
        val columns = if (measurables.all { it.minIntrinsicWidth(Constraints.Infinity) <= half }) 2 else 1
        val width = if (columns == 2) half else constraints.maxWidth
        val rows = measurables.map { it.measure(Constraints.fixedWidth(width)) }.chunked(columns)
        val height = rows.sumOf { row -> row.maxOf { it.height } } + gap * (rows.size - 1).coerceAtLeast(0)
        layout(constraints.maxWidth, height) {
            var y = 0
            rows.forEach { row ->
                row.forEachIndexed { index, part -> part.placeRelative(index * (width + gap), y) }
                y += row.maxOf { it.height } + gap
            }
        }
    }
}

private val PART_GAP = 16.dp

@Composable
private fun PartRing(
    share: Double?,
    value: String?,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val fill = MaterialTheme.colorScheme.tertiary
    val style = MaterialTheme.typography.labelLarge.withTabularFigures()
    Box(
        modifier =
            Modifier
                .size(with(LocalDensity.current) { style.fontSize.toDp() * RING_TO_LABEL })
                .drawBehind {
                    val width = 4.dp.toPx()
                    val inset = width / 2
                    val arcSize = Size(size.width - width, size.height - width)
                    drawArc(track, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(width))
                    val sweep = 360f * (share ?: 0.0).coerceIn(0.0, 1.0).toFloat()
                    if (sweep >
                        0
                    ) {
                        drawArc(fill, -90f, sweep, false, Offset(inset, inset), arcSize, style = Stroke(width, cap = StrokeCap.Round))
                    }
                },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = value ?: "–",
            style = style,
            color = if (value == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** Main's 56dp ring around its 14sp percentage, kept in proportion at any text size. */
private const val RING_TO_LABEL = 4

private data class StillNeededItem(
    val kind: LearnKind,
    val label: String,
    val detail: String?,
    val plusRequired: Boolean,
    val opensExam: Boolean,
)

@Composable
private fun StillToDo(
    preparation: GoalPreparation,
    stillNeeded: GoalProgressStillNeeded,
    links: PlanLinks,
) {
    val locale = currentLocale()
    val items =
        buildList {
            if (stillNeeded.left > 0) {
                val minutes = stillNeeded.minutes.toInt()
                add(
                    StillNeededItem(
                        kind = LearnKind.Lesson,
                        label =
                            stringResource(
                                if (stillNeeded.rule ==
                                    GoalProgressStillNeeded.Rule.EXAM_WEIGHTED
                                ) {
                                    R.string.plan_still_topics_solid
                                } else {
                                    R.string.plan_still_skills_solid
                                },
                            ),
                        detail =
                            if (minutes >
                                0
                            ) {
                                stringResource(R.string.plan_still_time_in_plan, formatMinutes(roundEstimate(minutes), locale))
                            } else {
                                null
                            },
                        plusRequired = false,
                        opensExam = false,
                    ),
                )
            }
            val fading = preparation.skills.fading.toInt()
            if (fading > 0) {
                add(
                    StillNeededItem(
                        LearnKind.Review,
                        stringResource(R.string.plan_still_keep_fresh),
                        pluralStringResource(R.plurals.plan_still_fading, fading, fading),
                        false,
                        false,
                    ),
                )
            }
            val mocks = preparation.components.mocks
            if (mocks.taken == 0L) {
                val (kind, label) =
                    when (mocks.kind) {
                        PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
                            LearnKind.Practice to stringResource(R.string.plan_still_full_review)
                        }

                        PreparationComponentsMocks.Kind.MOCK_EXAMS -> {
                            LearnKind.Mock to stringResource(R.string.plan_still_first_mock)
                        }

                        PreparationComponentsMocks.Kind.WEEKLY_CHALLENGES -> {
                            LearnKind.Challenge to stringResource(R.string.plan_still_first_challenge)
                        }
                    }
                add(StillNeededItem(kind, label, null, mocks.plusRequired, opensExam = kind == LearnKind.Mock))
            }
        }.take(MAX_STILL_SHOWN)
    if (items.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_still_to_do))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            items.forEach { item ->
                ListRow(
                    headline = { Text(item.label) },
                    onClick = if (item.opensExam && links.hasExam) links::exam else null,
                    leading = { KindMark(item.kind) },
                    supporting = item.detail?.let { { Text(it) } },
                    meta = if (item.plusRequired) ({ PlusMark() }) else null,
                )
            }
        }
    }
}

private const val MAX_STILL_SHOWN = 2
private const val DAY_RING_SHARE = 1.5f
private const val MINUTES_PER_HOUR = 60

/** Under two hours as is; beyond, to the hour, so an estimate never looks exact. */
private fun roundEstimate(minutes: Int): Int =
    if (minutes < 2 * MINUTES_PER_HOUR) minutes else ((minutes.toDouble() / MINUTES_PER_HOUR).roundToInt() * MINUTES_PER_HOUR)
