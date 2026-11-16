package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.LayoutDirection
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.theme.zoonkType

@Composable
fun Facts(
    facts: List<String>,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    style: TextStyle = MaterialTheme.zoonkType.data,
) = FactSegments(facts.filter(String::isNotEmpty).map(::AnnotatedString), modifier, color, style)

@Composable
fun Facts(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    style: TextStyle = LocalTextStyle.current,
) = Facts(AnnotatedString(text), modifier, color, style)

@Composable
fun Facts(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    style: TextStyle = LocalTextStyle.current,
) {
    var start = 0
    val parts =
        buildList {
            FACT_BREAK.findAll(text.text).forEach { separator ->
                add(text.subSequence(start, separator.range.first))
                start = separator.range.last + 1
            }
            add(text.subSequence(start, text.length))
        }.filter { it.isNotEmpty() }
    FactSegments(parts, modifier, color, style)
}

/** Each fact keeps its line; its dot hangs in the preceding fact's reserved room and is clipped at a new line's start, as Main's FactSegments does. */
@Composable
private fun FactSegments(
    facts: List<AnnotatedString>,
    modifier: Modifier,
    color: Color,
    style: TextStyle,
) {
    if (facts.size == 1) {
        Text(facts.single(), modifier = modifier, color = color, style = style)
        return
    }
    val type = LocalTextStyle.current.merge(style)
    val ink =
        when {
            color.isSpecified -> color
            type.color.isSpecified -> type.color
            else -> LocalContentColor.current
        }
    val separator = rememberTextMeasurer().measure(FACT_SEPARATOR, type.copy(color = ink))
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    FlowRow(
        modifier.clipToBounds().semantics(mergeDescendants = true) {},
    ) {
        facts.forEachIndexed { index, fact ->
            Box(
                Modifier
                    .drawBehind {
                        if (index > 0) drawText(separator, topLeft = Offset(if (rtl) size.width else -separator.size.width.toFloat(), 0f))
                    }.layout { measurable, constraints ->
                        val placed = measurable.measure(constraints)
                        val gap = if (index == facts.lastIndex) 0 else separator.size.width
                        layout(minOf(constraints.maxWidth, placed.width + gap), placed.height) { placed.placeRelative(0, 0) }
                    },
            ) {
                Text(fact, color = ink, style = type)
            }
        }
    }
}

private val FACT_BREAK = Regex("\\p{Zs}+·\\p{Zs}+")
