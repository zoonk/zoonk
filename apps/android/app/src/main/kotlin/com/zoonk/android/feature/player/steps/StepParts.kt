package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.findMarkdownTableLines

/** The pictures a lesson shows, loaded with the session the player shows. */
class LessonPictures(
    val images: PrivateImages,
    val session: AuthenticatedSession?,
)

val LocalLessonPictures = staticCompositionLocalOf<LessonPictures?> { null }

/** Sized from its stored width and height so nothing jumps; a picture that fails to load leaves no gap. */
@Composable
fun StepPicture(
    image: StepImage,
    modifier: Modifier = Modifier,
) {
    val pictures = LocalLessonPictures.current ?: return
    val context = LocalContext.current
    var failed by remember(image.url) { mutableStateOf(false) }
    val ratio = if (image.width != null && image.height != null && image.height > 0) image.width.toFloat() / image.height else DEFAULT_RATIO

    if (failed) return

    AsyncImage(
        model = remember(image.url, pictures.session) { pictures.images.request(context, image.url, pictures.session) },
        imageLoader = pictures.images.loader,
        contentDescription = image.alt,
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(ratio)
                .clip(RoundedCornerShape(16.dp)),
        contentScale = ContentScale.Fit,
        onError = { failed = true },
    )
}

private const val DEFAULT_RATIO = 4f / 3f

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
