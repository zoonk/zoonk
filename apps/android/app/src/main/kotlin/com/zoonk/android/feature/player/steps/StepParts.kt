package com.zoonk.android.feature.player.steps

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.data.recode
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.findMarkdownTableLines

@Composable
fun StepPicture(
    image: StepImage,
    frame: PictureFrame,
) = PrivatePicture(image.url, image.alt, image.width, image.height, frame)

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
