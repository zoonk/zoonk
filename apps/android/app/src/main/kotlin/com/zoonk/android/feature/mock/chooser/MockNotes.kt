package com.zoonk.android.feature.mock.chooser

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
import androidx.core.net.toUri
import com.zoonk.android.R
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.MockLeftOut
import com.zoonk.api.models.MockSizeSource
import com.zoonk.api.models.MockSizeSourcePastEdition

/**
 * Main's `MockSizeNote`: where the mock's size comes from whenever it isn't the notice, then [short]
 * (a mock that asks fewer questions than the exam), and `MockLeftOutNote`: what the real exam has
 * that the mock leaves out, and why. A result names a written part only full mocks ask
 * ([namesWrittenInFull]); the chooser shows it on the full options instead.
 */
@Composable
internal fun MockNotes(
    document: ExamDocument,
    source: MockSizeSource,
    questions: Long,
    minutes: Long,
    leftOut: List<MockLeftOut>,
    modifier: Modifier = Modifier,
    short: String? = null,
    namesWrittenInFull: Boolean = false,
) {
    val lines =
        sizeLines(document, source, questions, minutes) + listOfNotNull(short) +
            leftOut.mapNotNull { leftOutLine(it, namesWrittenInFull) }
    val pastEdition = source.pastEdition
    if (lines.isEmpty() && pastEdition == null) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        pastEdition?.let { NoteLine(pastEditionLine(it)) }
        lines.forEach { NoteLine(AnnotatedString(it)) }
    }
}

/** Main's `MockLeftOutNote` on its own, for a mock's intro. */
@Composable
internal fun MockLeftOutNote(
    leftOut: List<MockLeftOut>,
    modifier: Modifier = Modifier,
) {
    val lines = leftOut.mapNotNull { leftOutLine(it) }
    if (lines.isEmpty()) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) { lines.forEach { NoteLine(AnnotatedString(it)) } }
}

@Composable
private fun NoteLine(text: AnnotatedString) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
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
                linkInteractionListener = { CustomTabsIntent.Builder().build().launchUrl(context, url.toUri()) },
            ),
        ) { append(publisher) }
        append(text.substring(start + publisher.length))
    }
}

@Composable
private fun sizeLines(
    document: ExamDocument,
    source: MockSizeSource,
    questions: Long,
    minutes: Long,
): List<String> {
    val count = questions.toInt()
    val time = minutesText(minutes)
    val guide = document == ExamDocument.GUIDE

    if (source.material) {
        return listOfNotNull(
            pluralStringResource(R.plurals.mock_chooser_size_material_length, count, count, time)
                .takeIf { source.questions == MockSizeSource.Questions.UNSTATED || source.time == MockSizeSource.Time.UNSTATED },
            stringResource(R.string.mock_chooser_size_material_formats).takeIf { source.formats == MockSizeSource.Formats.EVEN },
        )
    }

    return listOfNotNull(
        when (source.questions) {
            MockSizeSource.Questions.UNSTATED -> {
                pluralStringResource(
                    if (guide) R.plurals.mock_chooser_size_guide_questions else R.plurals.mock_chooser_size_notice_questions,
                    count,
                    count,
                )
            }

            MockSizeSource.Questions.PAST_EDITION -> {
                pluralStringResource(
                    if (guide) R.plurals.mock_chooser_size_guide_past_edition else R.plurals.mock_chooser_size_notice_past_edition,
                    count,
                    count,
                )
            }

            MockSizeSource.Questions.NOTICE -> {
                null
            }
        },
        stringResource(if (guide) R.string.mock_chooser_size_guide_subjects else R.string.mock_chooser_size_notice_subjects)
            .takeIf { source.subjects == MockSizeSource.Subjects.EVEN },
        stringResource(if (guide) R.string.mock_chooser_size_guide_formats else R.string.mock_chooser_size_notice_formats)
            .takeIf { source.formats == MockSizeSource.Formats.EVEN },
        stringResource(if (guide) R.string.mock_chooser_size_guide_time else R.string.mock_chooser_size_notice_time, time)
            .takeIf { source.time == MockSizeSource.Time.UNSTATED },
    )
}

@Composable
private fun leftOutLine(
    leftOut: MockLeftOut,
    namesWrittenInFull: Boolean,
): String? {
    val name = leftOut.name
    return when (leftOut.part) {
        MockLeftOut.Part.LISTENING -> {
            name?.let { stringResource(R.string.mock_chooser_left_out_named, it) }
                ?: stringResource(R.string.mock_chooser_left_out_listening)
        }

        MockLeftOut.Part.SPEAKING -> {
            name?.let { stringResource(R.string.mock_chooser_left_out_named, it) }
                ?: stringResource(R.string.mock_chooser_left_out_speaking)
        }

        MockLeftOut.Part.PRACTICAL -> {
            name?.let { stringResource(R.string.mock_chooser_left_out_practical_named, it) }
                ?: stringResource(R.string.mock_chooser_left_out_practical)
        }

        MockLeftOut.Part.NUMERIC -> {
            stringResource(R.string.mock_chooser_left_out_numeric)
        }

        MockLeftOut.Part.SHORT_ANSWER -> {
            stringResource(R.string.mock_chooser_left_out_short_answer)
        }

        MockLeftOut.Part.WRITTEN -> {
            stringResource(R.string.mock_chooser_left_out_written, name.orEmpty())
        }

        MockLeftOut.Part.WRITTEN_IN_FULL -> {
            stringResource(R.string.mock_result_left_out_written_in_full, name.orEmpty()).takeIf { namesWrittenInFull }
        }
    }
}
