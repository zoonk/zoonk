package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.recode
import com.zoonk.android.feature.player.engine.askedPicture
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.ui.components.LessonVisual
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
        step.imagePending -> PicturePending(frame)
        frame == PictureFrame.Question && asked != null -> DescribedPicture(asked.alt)
    }
}

@Composable
private fun PicturePending(frame: PictureFrame) {
    val windowHeight =
        with(LocalDensity.current) {
            LocalWindowInfo.current.containerSize.height
                .toDp()
        }

    Surface(
        modifier =
            Modifier
                .heightIn(max = windowHeight * frame.heightShare)
                .aspectRatio(PENDING_RATIO)
                .semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(painterResource(R.drawable.ic_image), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                stringResource(R.string.player_drawing_picture),
                modifier = Modifier.padding(top = 8.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
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

private const val PENDING_RATIO = 4f / 5f

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

/** A question as a TalkBack heading, with any table of data above it. */
@Composable
fun QuestionText(text: String) {
    val (data, question) = remember(text) { splitQuestionData(text) }

    if (data != null) ContextText(data)
    if (question.isNotBlank()) {
        RichText(
            text = question,
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
    }
}

@Composable
fun ContextText(text: String?) {
    if (text.isNullOrBlank()) return
    RichText(text = text, style = MaterialTheme.typography.bodyLarge)
}
