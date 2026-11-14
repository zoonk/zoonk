package com.zoonk.android.feature.plan

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.toUpperCase
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.language.CanDoList
import com.zoonk.android.feature.language.LevelValue
import com.zoonk.android.feature.language.SkillLevelsCard
import com.zoonk.android.feature.speaking.SpeakingMockCard
import com.zoonk.android.feature.speaking.SpeakingPracticeRow
import com.zoonk.android.ui.components.DetailRow
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.QuietDisclosure
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.format.weekdayNames
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.EstimatedScore
import com.zoonk.api.models.GoalPreparation
import com.zoonk.api.models.GoalProgressStillNeeded
import com.zoonk.api.models.LanguagePlanLevel
import com.zoonk.api.models.PlanDay
import com.zoonk.api.models.PlanItem
import com.zoonk.api.models.PreparationComponentsMocks
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.min
import kotlin.math.roundToInt

enum class NumberVariant { Tiles, Stats }

private data class PlanNumber(
    val label: String,
    val value: String,
    val detail: String?,
    val share: Float? = null,
    val numeric: Boolean = true,
    val level: LanguagePlanLevel? = null,
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
                    is Standing.Language -> LanguageDetails(standing, links)
                    else -> PreparationDetails(standing, links)
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
                value = formatProgressShare(share.toDouble(), locale),
                detail = studiedLessonsLine(standing.done, standing.known),
                share = share,
            )
        }

        is Standing.Language -> {
            val level = standing.progress.level
            PlanNumber(
                label = stringResource(R.string.plan_level),
                value = level?.label ?: stringResource(R.string.plan_not_yet),
                detail = null,
                numeric = false,
                level = level,
            )
        }
    }
}

/** [known] counts within [done]: the lessons skipped because the learner showed they know them. */
@Composable
fun studiedLessonsLine(
    done: Long,
    known: Long,
): String {
    val studied = lessonsStudied(done, known)
    return if (studied == 0L) {
        stringResource(R.string.plan_no_lessons_studied_yet)
    } else {
        pluralStringResource(R.plurals.plan_lessons_studied, studied.toInt(), formatNumber(studied.toDouble(), currentLocale()))
    }
}

fun lessonsStudied(
    done: Long,
    known: Long,
): Long = (done - known).coerceAtLeast(0)

@Composable
private fun weekGain(gain: Double): String? {
    val points = (gain * PERCENT).roundToInt()
    return when {
        points == 0 -> null
        points > 0 -> pluralStringResource(R.plurals.plan_gain_this_week, points, points)
        else -> pluralStringResource(R.plurals.plan_loss_this_week, -points, points)
    }
}

private const val PERCENT = 100

/** The tile: the plan's state as its value, and its time a day or the lessons left as its one line. */
@Composable
private fun paceNumber(
    page: PlanPageState,
    pace: Pace,
): PlanNumber {
    val resting = page.isPaused && pace !is Pace.Finished && pace !is Pace.PastDate && pace !is Pace.ChallengesLeft
    val value = if (resting) stringResource(R.string.plan_pace_value_paused) else paceText(pace)
    val detail =
        when {
            pace is Pace.PastDate -> {
                pluralStringResource(R.plurals.plan_lessons_left, pace.lessons, pace.lessons)
            }

            resting -> {
                null
            }

            pace is Pace.OnTrack || pace is Pace.Ahead || pace is Pace.Behind -> {
                stringResource(
                    R.string.plan_time_a_day,
                    formatMinutes(
                        page.plan.schedule.dailyMinutes
                            .toInt(),
                        currentLocale(),
                    ),
                )
            }

            else -> {
                null
            }
        }
    return PlanNumber(stringResource(R.string.plan_pace), value, detail, numeric = false)
}

@Composable
private fun NumberButton(
    number: PlanNumber,
    variant: NumberVariant,
    modifier: Modifier,
    onOpen: () -> Unit,
) {
    val content: @Composable ColumnScope.() -> Unit = {
        // Main's `NumberButton`: a tile's label is a stat tile's (`text-label`), the aside's a section title.
        if (variant == NumberVariant.Tiles) {
            Text(
                text = number.label.toUpperCase(LocaleList.current),
                modifier = Modifier.clearAndSetSemantics { text = AnnotatedString(number.label) },
                style = MaterialTheme.zoonkType.label,
                color = MaterialTheme.zoonk.faint,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        } else {
            Text(number.label, style = MaterialTheme.zoonkType.sectionTitle, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        val style = MaterialTheme.typography.headlineSmall
        val level = number.level
        when {
            level != null -> LevelValue(level.label, level.target, style)
            number.numeric -> Readout(number.value, style = style)
            else -> Text(number.value, style = style.copy(fontWeight = FontWeight.SemiBold))
        }
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
            OutlinedButton(
                onClick = onAdjust,
                modifier = Modifier.padding(top = 4.dp),
            ) { Text(stringResource(R.string.plan_adjust_plan)) }
        }
        if (fix?.today == true) {
            OutlinedButton(onClick = links::today, modifier = Modifier.padding(top = 4.dp), forward = true) {
                Text(stringResource(R.string.plan_go_to_today))
            }
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
            onOpen = links::speaking,
            modifier = Modifier.bleed(LIST_ITEM_INSET),
        )
    }
    language.speakingMock?.let { exam ->
        SpeakingMockCard(exam, language.goal.id, language.speakingMockPaused, start = standing.startCall, open = links::open)
    }
}

/** The number that was tapped and what it's made of (main's `PreparationDetails`). */
@Composable
internal fun PreparationDetails(
    standing: Standing,
    links: PlanLinks,
) {
    val (progress, lessons) =
        when (standing) {
            is Standing.Preparation -> standing.progress to null
            is Standing.Progress -> standing.progress to standing
            is Standing.Language -> return
        }
    val preparation = progress.preparation ?: return
    val forExam = standing is Standing.Preparation
    val number = standingNumber(standing)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Readout(number.value, style = MaterialTheme.typography.displaySmall)
        number.share?.let { Meter(it) }
    }
    if (forExam) EstimatedScoreBlock(preparation)
    PreparationParts(preparation, if (forExam) null else lessons)
    NextSteps(preparation, progress.stillNeeded, forExam, links)
    QuietDisclosure(stringResource(R.string.plan_how_calculated)) {
        MetaLine(measureNote(preparation, forExam))
    }
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

/** A part with nothing to show yet has no row. */
@Composable
private fun PreparationParts(
    preparation: GoalPreparation,
    lessons: Standing.Progress?,
) {
    val locale = currentLocale()
    val coverage = preparation.components.coverage
    val mastery = preparation.components.mastery
    val retention = preparation.components.retention
    val mocks = preparation.components.mocks
    val taken = mocks.taken.toInt()

    @Composable
    fun count(
        done: Long,
        total: Long,
    ) = stringResource(R.string.plan_done_of_total, formatNumber(done.toDouble(), locale), formatNumber(total.toDouble(), locale))

    Column {
        if (lessons != null) {
            DetailRow(stringResource(R.string.plan_lessons), count(lessons.done, lessons.total), mono = true)
        } else {
            DetailRow(stringResource(R.string.plan_topics_studied), count(coverage.studiedSkills, coverage.totalSkills), mono = true)
        }
        if (mastery.value != null) {
            DetailRow(stringResource(R.string.plan_right_answers), count(mastery.correct, mastery.answered), mono = true)
        }
        retention.value?.let { DetailRow(stringResource(R.string.plan_remembered), formatPercent(it, locale), mono = true) }
        if (taken > 0) {
            when (mocks.kind) {
                PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
                    DetailRow(
                        stringResource(R.string.plan_reviews_of_every_topic),
                        pluralStringResource(R.plurals.plan_reviews_done, taken, taken),
                        mono = true,
                    )
                }

                PreparationComponentsMocks.Kind.MOCK_EXAMS -> {
                    DetailRow(
                        stringResource(R.string.plan_mock_exams),
                        pluralStringResource(R.plurals.plan_tests_taken, taken, taken),
                        mono = true,
                    )
                }

                PreparationComponentsMocks.Kind.WEEKLY_CHALLENGES -> {
                    DetailRow(
                        stringResource(R.string.plan_weekly_challenges),
                        pluralStringResource(R.plurals.plan_tests_taken, taken, taken),
                        mono = true,
                    )
                }
            }
        }
    }
}

@Composable
private fun measureNote(
    preparation: GoalPreparation,
    forExam: Boolean,
): String {
    val threshold = formatPercent(TEST_THRESHOLD, currentLocale())
    return when {
        !forExam -> {
            stringResource(R.string.plan_measure_progress)
        }

        preparation.components.mocks.kind == PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
            stringResource(R.string.plan_measure_review_once, threshold)
        }

        else -> {
            stringResource(R.string.plan_measure_mock_exam, threshold)
        }
    }
}

private data class NextStep(
    val kind: LearnKind,
    val label: String,
    val detail: String?,
    val opensExam: Boolean = false,
)

/** At most two steps, the test's last: a learner without mock exams reviews every topic, as their day names it. */
@Composable
private fun NextSteps(
    preparation: GoalPreparation,
    stillNeeded: GoalProgressStillNeeded,
    forExam: Boolean,
    links: PlanLinks,
) {
    val mocks = preparation.components.mocks
    val fading = preparation.skills.fading.toInt()
    val skills =
        NextStep(
            LearnKind.Lesson,
            stringResource(
                if (stillNeeded.rule == GoalProgressStillNeeded.Rule.EXAM_WEIGHTED) {
                    R.string.plan_next_topics_count_most
                } else {
                    R.string.plan_next_keep_going
                },
            ),
            detail = null,
        ).takeIf { stillNeeded.left > 0 }
    val memory =
        NextStep(
            LearnKind.Review,
            stringResource(R.string.plan_next_review_forgetting),
            pluralStringResource(R.plurals.plan_next_topics_in_reviews, fading, fading),
        ).takeIf { fading > 0 }
    val testDetail =
        if (forExam && mocks.kind != PreparationComponentsMocks.Kind.WEEKLY_CHALLENGES) {
            stringResource(R.string.plan_next_past_share, formatPercent(TEST_THRESHOLD, currentLocale()))
        } else {
            null
        }
    val test =
        when (mocks.kind) {
            PreparationComponentsMocks.Kind.FULL_REVIEWS -> {
                NextStep(LearnKind.Practice, stringResource(R.string.plan_next_review_every_topic), testDetail)
            }

            PreparationComponentsMocks.Kind.MOCK_EXAMS -> {
                NextStep(LearnKind.Mock, stringResource(R.string.plan_still_first_mock), testDetail, opensExam = true)
            }

            PreparationComponentsMocks.Kind.WEEKLY_CHALLENGES -> {
                NextStep(LearnKind.Challenge, stringResource(R.string.plan_still_first_challenge), testDetail)
            }
        }.takeIf { mocks.taken == 0L }
    val steps = listOfNotNull(skills, memory, test).take(MAX_STEPS_SHOWN)
    if (steps.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_next))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            steps.forEach { step ->
                ListRow(
                    headline = { Text(step.label) },
                    onClick = if (step.opensExam && links.hasExam) links::exam else null,
                    leading = { KindMark(step.kind) },
                    supporting = step.detail?.let { { Text(it) } },
                )
            }
        }
    }
}

private const val MAX_STEPS_SHOWN = 2

/** Core keeps a subject under this share until the learner takes their first test of it. */
private const val TEST_THRESHOLD = 0.75
private const val DAY_RING_SHARE = 1.5f
