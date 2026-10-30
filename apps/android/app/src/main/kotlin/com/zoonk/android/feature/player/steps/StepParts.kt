package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.recode
import com.zoonk.android.feature.player.engine.askedPicture
import com.zoonk.android.feature.player.engine.isOwnPictureDrawing
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.PendingPicture
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.findMarkdownTableLines

/**
 * Main's `LessonStepPicture`: the picture, a placeholder in its place while it's drawn, and on a
 * question whose picture never came, its description instead.
 */
@Composable
fun StepPicture(
    step: LessonStep,
    frame: PictureFrame,
) {
    val image = step.image
    val asked = step.askedPicture

    when {
        image != null -> PrivatePicture(image.url, image.alt, image.width, image.height, frame)
        step.isOwnPictureDrawing -> StepPicturePending(frame, asked?.alt?.takeIf { frame == PictureFrame.Question })
        frame == PictureFrame.Question && asked != null -> DescribedPicture(asked.alt)
    }
}

@Composable
private fun StepPicturePending(
    frame: PictureFrame,
    alt: String?,
) {
    PendingPicture(frame) {
        Icon(painterResource(R.drawable.ic_image), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            stringResource(R.string.player_drawing_picture),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (alt != null) {
            Text(
                alt,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun DescribedPicture(alt: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(R.drawable.ic_image), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(alt, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun LessonStepVisual(visual: StepVisual?) {
    val shown = remember(visual) { visual?.recode<StepVisual, LessonVisual>() } ?: return
    LessonVisual(shown)
}

/**
 * A question with a table of data above it: main splits the table off so the question reads as one
 * sentence (`splitQuestionData`).
 */
fun splitQuestionData(text: String): Pair<String?, String> {
    val lines = text.lines()
    val tableLines = findMarkdownTableLines(lines)

    if (tableLines.isEmpty()) return null to text

    val isProse = { index: Int -> index !in tableLines && lines[index].isNotBlank() }
    val end = lines.indices.lastOrNull(isProse) ?: return text to ""
    val start = (lines.indices.lastOrNull { it < end && !isProse(it) } ?: -1) + 1
    val data = (lines.take(start) + lines.drop(end + 1)).joinToString("\n").trim()

    return data to lines.subList(start, end + 1).joinToString("\n")
}

/** A question as a TalkBack heading, with any table of data above it; it steps back once answered. */
@Composable
fun QuestionText(
    text: String,
    answered: Boolean = false,
) {
    val (data, question) = remember(text) { splitQuestionData(text) }

    if (data != null) ContextText(data)
    if (question.isNotBlank()) {
        RichText(
            text = question,
            modifier = Modifier.semantics { heading() },
            style =
                MaterialTheme.typography.titleLarge.copy(
                    color = if (answered) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                ),
        )
    }
}

@Composable
fun ContextText(text: String?) {
    if (text.isNullOrBlank()) return
    RichText(text = text, style = MaterialTheme.typography.bodyLarge)
}
