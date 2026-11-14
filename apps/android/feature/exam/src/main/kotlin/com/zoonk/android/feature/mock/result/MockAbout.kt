package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.openWebPage
import com.zoonk.android.feature.mock.chooser.minutesText
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockLeftOut
import com.zoonk.api.models.MockScoreNotes
import com.zoonk.api.models.MockSizeSource
import com.zoonk.api.models.MockSizeSourcePastEdition

/**
 * Main's `useMockAbout`: everything that qualifies how to read a mock exam's result, said once, in
 * its details. The chooser, the intro and the running mock exam say none of it.
 */
@Composable
internal fun mockAboutLines(view: MockExam): List<String> {
    val examQuestions = view.examQuestions?.takeIf { it > view.questions }
    val questions = view.questions.toInt()
    val reused = view.reusedQuestions.toInt()
    return (
        scoreLines(view.scoreNotes) +
            listOfNotNull(
                examQuestions?.let {
                    pluralStringResource(R.plurals.mock_result_had_of, questions, questions, formatNumber(it.toDouble(), currentLocale()))
                },
                sizeLine(view.sizeSource, questions, view.minutes),
                reused.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.mock_result_repeats, it, it) },
            ) +
            view.leftOut.mapNotNull { leftOutLine(it) }
    ).distinct()
}

@Composable
internal fun MockAbout(
    view: MockExam,
    lines: List<String>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        lines.forEach { NoteLine(AnnotatedString(it)) }
        view.sizeSource.pastEdition?.let { NoteLine(pastEditionLine(it)) }
    }
}

@Composable
private fun NoteLine(text: AnnotatedString) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun scoreLines(notes: MockScoreNotes): List<String> {
    val locale = currentLocale()
    val scale = notes.scale
    val unconverted = scale != null && scale.score == null

    return listOfNotNull(
        scale?.let {
            val min = formatNumber(it.min, locale)
            val max = formatNumber(it.max, locale)
            val name = it.name
            val shown = it.score?.let { score -> formatNumber(score, locale) }
            when {
                shown == null && name != null -> stringResource(R.string.mock_result_scale_named, name, min, max)
                shown == null -> stringResource(R.string.mock_result_scale, min, max)
                name != null -> stringResource(R.string.mock_result_scale_score_named, shown, name, min, max)
                else -> stringResource(R.string.mock_result_scale_score, shown, min, max)
            }
        },
        scale?.passScore?.let { stringResource(R.string.mock_result_pass_score, formatNumber(it, locale)) },
        notes.noticeScoring?.let { stringResource(R.string.mock_result_notice_scoring, it) },
        stringResource(R.string.mock_result_relative).takeIf { notes.relative },
        stringResource(R.string.mock_result_shows_right).takeIf { notes.noticeScoring != null || notes.relative || unconverted },
    )
}

/** Where the mock exam's size comes from, whenever the official guide doesn't give it. */
@Composable
private fun sizeLine(
    source: MockSizeSource,
    questions: Int,
    minutes: Long,
): String? {
    if (source.questions == MockSizeSource.Questions.NOTICE && source.time == MockSizeSource.Time.NOTICE) return null
    val time = minutesText(minutes)
    return pluralStringResource(
        if (source.material) R.plurals.mock_result_size_material else R.plurals.mock_result_size_guide,
        questions,
        questions,
        time,
    )
}

@Composable
private fun pastEditionLine(source: MockSizeSourcePastEdition): AnnotatedString {
    val context = LocalContext.current
    val url = source.url.toString()
    val publisher = source.url.host?.removePrefix("www.") ?: url
    val text =
        source.edition?.let { stringResource(R.string.mock_chooser_size_past_edition, it, publisher) }
            ?: stringResource(R.string.mock_chooser_size_latest_exam, publisher)
    val start = text.lastIndexOf(publisher)

    return buildAnnotatedString {
        append(text.substring(0, start))
        withLink(
            LinkAnnotation.Clickable(
                tag = url,
                styles = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline)),
                linkInteractionListener = { openWebPage(context, url) },
            ),
        ) { append(publisher) }
        append(text.substring(start + publisher.length))
    }
}

@Composable
private fun leftOutLine(leftOut: MockLeftOut): String? {
    val name = leftOut.name
    return when (leftOut.part) {
        MockLeftOut.Part.LISTENING -> {
            name?.let { stringResource(R.string.mock_result_left_out_named, it) } ?: stringResource(R.string.mock_result_left_out_listening)
        }

        MockLeftOut.Part.SPEAKING -> {
            name?.let { stringResource(R.string.mock_result_left_out_named, it) } ?: stringResource(R.string.mock_result_left_out_speaking)
        }

        MockLeftOut.Part.PRACTICAL -> {
            name?.let { stringResource(R.string.mock_result_left_out_practical_named, it) }
                ?: stringResource(R.string.mock_result_left_out_practical)
        }

        MockLeftOut.Part.WRITTEN -> {
            stringResource(R.string.mock_result_left_out_named, name.orEmpty())
        }

        MockLeftOut.Part.WRITTEN_IN_FULL -> {
            stringResource(R.string.mock_result_left_out_written_in_full, name.orEmpty())
        }

        MockLeftOut.Part.CHOICE -> {
            stringResource(R.string.mock_result_left_out_choice, name.orEmpty())
        }

        MockLeftOut.Part.NUMERIC, MockLeftOut.Part.SHORT_ANSWER -> {
            null
        }
    }
}
