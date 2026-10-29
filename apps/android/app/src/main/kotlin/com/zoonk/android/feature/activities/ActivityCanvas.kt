package com.zoonk.android.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/**
 * Main's `ActivityCanvas`: the panel a template draws in. [description] says what a drawing shows,
 * in words, for TalkBack; a canvas of text and controls says it all already, so it has none.
 */
@Composable
fun ActivityCanvas(
    modifier: Modifier = Modifier,
    description: String? = null,
    gap: Dp = 12.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = CANVAS_ALPHA))
                .then(if (description == null) Modifier else Modifier.semantics { contentDescription = description })
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(gap),
        content = content,
    )
}

/** Main's `LineMarker`: a small icon centered on the first line of [style]'s text beside it, at any font size. */
@Composable
fun LineMarker(
    style: TextStyle,
    content: @Composable () -> Unit,
) {
    val height = with(LocalDensity.current) { style.lineHeight.toDp() }
    Box(Modifier.height(height), contentAlignment = Alignment.Center) { content() }
}

/** Main's `ActivityReadout`: the big live number. */
@Composable
fun ActivityReadout(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    Text(
        text,
        modifier,
        color,
        style =
            MaterialTheme.typography.headlineSmall
                .withTabularFigures()
                .copy(fontWeight = FontWeight.Medium),
    )
}

@Composable
fun ActivityCanvasLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
}

/** Main's `ActivitySelectGrid`: tiles in equal columns, each row as tall as its tallest tile. */
@Composable
fun <T> ActivitySelectGrid(
    items: List<T>,
    label: String,
    modifier: Modifier = Modifier,
    columns: Int = 2,
    tile: @Composable RowScope.(T) -> Unit,
) {
    Column(modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(columns).forEach { row ->
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { tile(it) }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * Main's `ActivitySelectGridItem`: a pick is ink, and checking marks it right or wrong with a
 * symbol as well as a color. A [Role.Checkbox] tile toggles, a [Role.RadioButton] one is picked,
 * and a [Role.Button] one acts at once.
 */
@Composable
fun RowScope.ActivityTile(
    picked: Boolean,
    result: AnswerResult?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    role: Role = Role.Checkbox,
    content: @Composable RowScope.() -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(12.dp)
    val choice =
        when (role) {
            Role.Checkbox -> Modifier.toggleable(value = picked, enabled = enabled, role = role, onValueChange = { onClick() })
            Role.RadioButton -> Modifier.selectable(selected = picked, enabled = enabled, role = role, onClick = onClick)
            else -> Modifier.clickable(enabled = enabled, role = role, onClick = onClick)
        }

    Row(
        modifier =
            modifier
                .weight(1f)
                .fillMaxHeight()
                .heightIn(min = 48.dp)
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .then(choice)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (result == AnswerResult.Right || result == AnswerResult.Wrong) ResultMark(result)
        CompositionLocalProvider(LocalContentColor provides tone.contentColor) {
            val style = MaterialTheme.typography.bodyMedium
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProvideTextStyle(if (picked || result == AnswerResult.Right) style.copy(fontWeight = FontWeight.Medium) else style) {
                    content()
                }
            }
        }
    }
}

@Composable
private fun ResultMark(result: AnswerResult) {
    val right = result == AnswerResult.Right
    Icon(
        painter = painterResource(if (right) R.drawable.ic_check else R.drawable.ic_close),
        contentDescription = null,
        modifier = Modifier.size(16.dp),
        tint = if (right) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
    )
}

/** Main's takeaway line: what to remember, after its lightbulb. */
@Composable
fun ActivityTakeaway(
    text: String,
    modifier: Modifier = Modifier,
) {
    val style = MaterialTheme.typography.bodyMedium
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LineMarker(style) {
            Icon(
                painterResource(R.drawable.ic_lightbulb),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.zoonk.vizHighlight,
            )
        }
        RichText(text, style = style)
    }
}

/** Main's canvas is half-strength muted, so its controls' muted tracks still stand out on it. */
private const val CANVAS_ALPHA = 0.5f
