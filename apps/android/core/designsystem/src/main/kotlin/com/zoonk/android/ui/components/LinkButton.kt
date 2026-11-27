package com.zoonk.android.ui.components

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp

/**
 * Main's `link` button: words on the start edge, underlined at rest since a touch screen has no hover to show it's a
 * link. The line is the words' ink at 30%, 4dp under each line's baseline (main's `decoration-foreground/30
 * underline-offset-4`), so it marks the words without striking under them.
 */
@Composable
fun LinkButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    size: ButtonSize = LocalButtonSize.current,
) = TextButton(
    onClick = onClick,
    modifier = modifier,
    enabled = enabled,
    busy = busy,
    focusableWhenDisabled = focusableWhenDisabled,
    edge = ButtonEdge.Start,
    size = size,
) {
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val line = LocalContentColor.current.copy(alpha = LINK_LINE_ALPHA)
    Text(
        text = text,
        modifier =
            Modifier.drawBehind {
                val shown = layout ?: return@drawBehind
                for (index in 0 until shown.lineCount) {
                    val y = shown.getLineBaseline(index) + LINK_LINE_OFFSET.toPx()
                    drawLine(
                        color = line,
                        start = Offset(shown.getLineLeft(index), y),
                        end = Offset(shown.getLineRight(index), y),
                        strokeWidth = LINK_LINE_WIDTH.toPx(),
                    )
                }
            },
        onTextLayout = { layout = it },
    )
}

private const val LINK_LINE_ALPHA = 0.3f
private val LINK_LINE_OFFSET = 4.dp
private val LINK_LINE_WIDTH = 1.dp
