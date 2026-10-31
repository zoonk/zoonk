package com.zoonk.android.feature.language

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import com.zoonk.android.R

/**
 * Main's `LevelValue`: the level, then the goal's level after an arrow, quieter. TalkBack hears
 * "B1, goal B2" as this text, so a row merging it still reads its other words.
 */
@Composable
fun LevelValue(
    label: String,
    target: String?,
    style: TextStyle,
    modifier: Modifier = Modifier,
) {
    if (target == null) {
        Text(label, modifier, style = style)
        return
    }

    val quiet = SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = MaterialTheme.typography.bodyLarge.fontSize)
    val spoken = AnnotatedString(stringResource(R.string.language_level_toward_goal, label, target))
    Text(
        text =
            buildAnnotatedString {
                append(label)
                withStyle(quiet) { append("\u00A0→\u00A0$target") }
            },
        modifier = modifier.clearAndSetSemantics { text = spoken },
        style = style,
    )
}
