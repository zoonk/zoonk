package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.richtext.RichTextLine
import com.zoonk.android.ui.richtext.SpokenText

/**
 * Under a match board's verdict, the pairs the learner first put together wrong (main's `MatchMisses`): the solved board
 * above shows every pair right. One line per card that had a wrong try, its first one, for the first few cards. Each
 * [card] shows as written, since one can be a sentence with its own punctuation.
 */
@Composable
fun MatchMisses(
    misses: List<MatchTry>,
    card: @Composable (MatchSide, Int) -> SpokenText,
) {
    val shown = misses.distinctBy { it.left }.take(SHOWN_MISSES)
    if (shown.isEmpty()) return
    val style = MaterialTheme.typography.bodyMedium
    val muted = SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(stringResource(R.string.questions_match_first_tries), style = style)
        shown.forEach { miss ->
            val left = card(MatchSide.Left, miss.left)
            val right = card(MatchSide.Right, miss.right)
            val line =
                buildAnnotatedString {
                    append(left.text)
                    withStyle(muted) { append(ARROW) }
                    append(right.text)
                }
            val spoken = if (left.spoken == null && right.spoken == null) null else left.said + ARROW + right.said
            RichTextLine(SpokenText(line, spoken), Modifier, style)
        }
    }
}

private val SpokenText.said: String get() = spoken ?: text.text

private const val ARROW = " → "

private const val SHOWN_MISSES = 3
