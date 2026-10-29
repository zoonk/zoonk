package com.zoonk.android.feature.exam

import android.icu.text.ListFormatter
import androidx.annotation.DrawableRes
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamFormatDay
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.ExamViewScoring
import com.zoonk.api.models.NetCalibration
import com.zoonk.api.models.TargetCutoff
import kotlinx.datetime.toJavaLocalDate
import java.net.URI
import java.time.LocalDate
import java.util.Locale

/** What main's aside says about the exam, beside the page or after it. */
internal enum class AboutSection { Format, Scoring, DateNote }

internal fun aboutSections(exam: ExamView): List<AboutSection> =
    listOfNotNull(
        AboutSection.Format.takeIf { exam.format.isNotEmpty() },
        AboutSection.Scoring.takeIf {
            exam.scoring.rule != null || exam.cutoff != null || exam.passMarks != null || exam.scoring.noticeScale != null
        },
        AboutSection.DateNote.takeIf { exam.dateNote != null },
    )

@Composable
internal fun AboutSection(
    section: AboutSection,
    exam: ExamView,
) {
    when (section) {
        AboutSection.Format -> {
            ExamFormatSection(exam.format)
        }

        AboutSection.Scoring -> {
            ExamScoringSection(exam)
        }

        AboutSection.DateNote -> {
            exam.dateNote?.let {
                Text(stringResource(it), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun ExamFormatSection(format: List<ExamFormatDay>) {
    val title =
        when (format.size) {
            1 -> stringResource(R.string.exam_format_one_day)
            2 -> stringResource(R.string.exam_format_two_days)
            else -> stringResource(R.string.exam_format_days, format.size)
        }
    val parts = format.flatMap { it.parts }
    val questions = parts.filterNot { it.written }.sumOf { it.questions ?: 0L }.toInt()
    val detail =
        (
            listOfNotNull(questions.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.exam_questions, it, it) }) +
                parts.filter { it.written }.map { it.name }
        ).joinToString(" · ")
            .takeIf { it.isNotEmpty() && format.size > 1 }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionTitle(title, detail)
        Column {
            format.forEachIndexed { index, day ->
                if (index > 0) HorizontalDivider()
                FormatDayRow(day, numbered = format.size > 1)
            }
        }
    }
}

@Composable
private fun FormatDayRow(
    day: ExamFormatDay,
    numbered: Boolean,
) {
    val locale = currentLocale()
    val dayName = stringResource(R.string.exam_format_day, day.day.toInt())
    val questions =
        day.parts
            .filterNot { it.written }
            .sumOf { it.questions ?: 0L }
            .toInt()
    val names = ListFormatter.getInstance(locale).format(day.parts.map { it.name })
    val parts =
        if (questions > 0) {
            stringResource(
                R.string.exam_format_parts_questions,
                names,
                pluralStringResource(R.plurals.exam_questions, questions, questions),
            )
        } else {
            names
        }
    val numbers = MaterialTheme.typography.labelMedium.withTabularFigures()

    Column(
        Modifier.fillMaxWidth().padding(vertical = 10.dp).semantics(mergeDescendants = true) {
        },
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (numbered) Text(dayName, color = MaterialTheme.colorScheme.onSurfaceVariant, style = numbers)
            Text(
                day.date?.let { examDayDate(it.toJavaLocalDate(), LocalDate.now(), locale) } ?: dayName,
                Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
            day.minutes
                ?.takeIf {
                    it > 0
                }?.let {
                    Text(
                        formatDuration(it * SECONDS_PER_MINUTE, locale),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = numbers,
                    )
                }
        }
        Text(parts, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ExamScoringSection(exam: ExamView) {
    val rule = scoringRule(exam.scoring)
    val scale = exam.scoring.noticeScale
    val passMarks = exam.passMarks
    val cutoff = exam.cutoff
    val locale = currentLocale()

    val rows =
        listOfNotNull<@Composable () -> Unit>(
            rule?.let {
                {
                    ScoringRow(R.drawable.ic_balance, it.first) {
                        Line(it.second)
                        exam.calibration?.let { calibration -> Calibration(calibration) }
                    }
                }
            },
            scale?.let {
                {
                    ScoringRow(
                        R.drawable.ic_speed,
                        it.name?.let { name ->
                            stringResource(R.string.exam_scale_named, name)
                        } ?: stringResource(R.string.exam_scale_own),
                    ) {
                        Line(stringResource(R.string.exam_scale_range, formatNumber(it.min, locale), formatNumber(it.max, locale)))
                        it.passScore?.let { pass -> Line(stringResource(R.string.exam_scale_pass, formatNumber(pass, locale))) }
                    }
                }
            },
            passMarks?.let {
                {
                    ScoringRow(R.drawable.ic_flag, stringResource(R.string.exam_to_pass)) {
                        it.texts.forEach { text -> Line(text) }
                        if (it.language != locale.language) {
                            val language = Locale.forLanguageTag(it.language).getDisplayLanguage(locale).ifEmpty { it.language }
                            Line(stringResource(R.string.exam_pass_marks_language, language))
                        }
                    }
                }
            },
            cutoff?.let { { CutoffRow(it, exam.targetScore) } },
        )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionTitle(stringResource(R.string.exam_scoring_title), detail = null)
        OutlinedCard(Modifier.fillMaxWidth()) {
            rows.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider()
                row()
            }
        }
    }
}

/** The rule's title and what it means for answering, in main's words. */
@Composable
private fun scoringRule(scoring: ExamViewScoring): Pair<String, String>? {
    val locale = currentLocale()
    val penalty = scoring.wrongPenalty
    return when (scoring.rule) {
        ExamViewScoring.Rule.NET -> {
            val title =
                if (penalty == 1.0) {
                    stringResource(R.string.exam_rule_net_cancels)
                } else {
                    stringResource(R.string.exam_rule_net_costs, formatPercent(penalty, locale))
                }
            // Core's `getBreakEven`: answering pays above this chance of being right.
            title to stringResource(R.string.exam_rule_net, formatPercent(penalty / (1 + penalty), locale))
        }

        ExamViewScoring.Rule.IRT -> {
            stringResource(R.string.exam_rule_irt_title) to stringResource(R.string.exam_rule_irt)
        }

        ExamViewScoring.Rule.RAW -> {
            stringResource(R.string.exam_rule_raw_title) to stringResource(R.string.exam_rule_raw)
        }

        null -> {
            null
        }
    }
}

@Composable
private fun Calibration(calibration: NetCalibration) {
    val sure = calibration.sure
    val unsure = calibration.unsure
    if (sure.answered + unsure.answered == 0L) return

    Text(
        stringResource(
            R.string.exam_calibration,
            pluralStringResource(R.plurals.exam_calibration_right, sure.right.toInt(), sure.right.toInt(), sure.answered.toInt()),
            pluralStringResource(R.plurals.exam_calibration_right, unsure.right.toInt(), unsure.right.toInt(), unsure.answered.toInt()),
        ),
        Modifier.padding(top = 4.dp),
        style = MaterialTheme.typography.bodyMedium,
    )
    when (calibration.advice) {
        NetCalibration.Advice.BLANK_UNSURE -> Line(stringResource(R.string.exam_calibration_blank_unsure))
        NetCalibration.Advice.KEEP_ANSWERING -> Line(stringResource(R.string.exam_calibration_keep_answering))
        null -> Unit
    }
}

@Composable
private fun CutoffRow(
    cutoff: TargetCutoff,
    targetScore: String?,
) {
    val locale = currentLocale()
    val context = LocalContext.current
    val number = { value: Double -> formatNumber(value, locale, maximumFractionDigits = 1) }
    val score = stringResource(R.string.exam_cutoff_score, number(cutoff.score), number(cutoff.maxScore))
    val detail =
        listOf(cutoff.course, cutoff.position, cutoff.institution.takeIf { cutoff.course != null }, cutoff.edition, cutoff.quota)
            .filterNot { it.isNullOrBlank() }
            .joinToString(" · ")
    val site = sourceSite(cutoff.source.url)
    val source = stringResource(R.string.exam_cutoff_source, detail, site)

    ScoringRow(R.drawable.ic_target, stringResource(R.string.exam_cutoff_title, score)) {
        Text(
            linked(source, site, cutoff.source.url) { CustomTabsIntent.Builder().build().launchUrl(context, it.toUri()) },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        targetScore?.let { Line(stringResource(R.string.exam_cutoff_goal, it)) }
    }
}

/** [text] with [words] as a link that [open]s [url]. */
private fun linked(
    text: String,
    words: String,
    url: String,
    open: (String) -> Unit,
): AnnotatedString =
    buildAnnotatedString {
        val start = text.lastIndexOf(words)
        if (start < 0) {
            append(text)
            return@buildAnnotatedString
        }
        append(text.substring(0, start))
        withLink(
            LinkAnnotation.Clickable(
                tag = url,
                styles = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline)),
                linkInteractionListener = { open(url) },
            ),
        ) { append(words) }
        append(text.substring(start + words.length))
    }

/** A source's site as people say it: "sisu.mec.gov.br". */
private fun sourceSite(url: String): String =
    runCatching { URI(url).host }
        .getOrNull()
        ?.removePrefix("www.")
        ?: url

@Composable
private fun ScoringRow(
    @DrawableRes icon: Int,
    title: String,
    content: @Composable () -> Unit,
) {
    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.bodyMedium.withTabularFigures(), fontWeight = FontWeight.Medium)
            content()
        }
    }
}

@Composable
private fun Line(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun SectionTitle(
    title: String,
    detail: String?,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
        Text(title, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        detail?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium.withTabularFigures())
        }
    }
}

private const val SECONDS_PER_MINUTE = 60L
