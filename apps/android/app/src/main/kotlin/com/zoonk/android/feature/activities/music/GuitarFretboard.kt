package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * Main's `GuitarFretboard`, high E on top and the nut on the left in every language. With [onChange] each string is a radio
 * group (not played, open, or one of the frets shown) and one Tab stop whose arrows pick along it; without it the board shows
 * a shape and says it in words.
 */
@Composable
internal fun GuitarFretboard(
    firstFret: Int,
    voicing: GuitarVoicing,
    labels: MusicLabels,
    markOf: (Int) -> NoteMarkKind,
    nameOf: (Int) -> String,
    modifier: Modifier = Modifier,
    onChange: ((string: Int, fret: Int?) -> Unit)? = null,
    enabled: Boolean = true,
) {
    val frets = (firstFret until firstFret + Guitar.FRETBOARD_SPAN).toList()
    val nameWidth = with(LocalDensity.current) { NAME_WIDTH.toDp() }
    val shown =
        if (onChange == null) {
            Modifier.clearAndSetSemantics { contentDescription = labels.shape(voicing).joinToString(". ") }
        } else {
            Modifier
        }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Column(modifier.fillMaxWidth().then(shown)) {
            Guitar.tuning.indices.reversed().forEach { string ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StringName(labels.stringNames[string], nameWidth)
                    if (onChange == null) {
                        StringRow(string, voicing[string], frets, firstFret, markOf, nameOf)
                    } else {
                        StringPicker(string, voicing[string], frets, firstFret, labels, markOf, nameOf, enabled) { onChange(string, it) }
                    }
                }
            }

            Row(Modifier.clearAndSetSemantics {}) {
                Box(Modifier.width(nameWidth + if (onChange == null) INDICATOR_WIDTH else PICK_WIDTH * 2))
                frets.forEach { fret ->
                    Text(
                        "$fret",
                        Modifier.weight(1f).padding(top = 4.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                    )
                }
            }
        }
    }
}

@Composable
private fun StringName(
    name: String,
    width: Dp,
) {
    Text(
        name,
        Modifier.width(width).clearAndSetSemantics {},
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
    )
}

@Composable
private fun RowScope.StringRow(
    string: Int,
    fret: Int?,
    frets: List<Int>,
    firstFret: Int,
    markOf: (Int) -> NoteMarkKind,
    nameOf: (Int) -> String,
) {
    Box(Modifier.width(INDICATOR_WIDTH), contentAlignment = Alignment.Center) {
        when (fret) {
            null -> MutedMark(isPicked = true)
            0 -> OpenMark(isPicked = true)
        }
    }
    frets.forEachIndexed { index, it ->
        FretCell(isFirst = index == 0, firstFret = firstFret, minHeight = SHOWN_HEIGHT) {
            if (fret == it) NoteMark(markOf(string), nameOf(Guitar.noteMidi(string, it)))
        }
    }
}

@Composable
private fun RowScope.StringPicker(
    string: Int,
    current: Int?,
    frets: List<Int>,
    firstFret: Int,
    labels: MusicLabels,
    markOf: (Int) -> NoteMarkKind,
    nameOf: (Int) -> String,
    enabled: Boolean,
    onPick: (Int?) -> Unit,
) {
    val options = listOf(null, 0) + frets
    val roving = rememberRovingFocus(options.size, initial = options.indexOf(current).coerceAtLeast(0))

    Row(
        Modifier
            .weight(1f)
            .selectableGroup()
            .semantics {
                contentDescription = labels.string(string)
                isTraversalGroup = true
            },
    ) {
        options.forEachIndexed { column, fret ->
            val isPicked = current == fret
            val pick =
                Modifier
                    .rovingFocus(roving, column) { if (enabled) onPick(options[it]) }
                    .semantics { contentDescription = labels.position(string, fret) }
                    .selectable(isPicked, enabled = enabled, role = Role.RadioButton) {
                        roving.active = column
                        onPick(fret)
                    }

            when (fret) {
                null -> {
                    Box(Modifier.width(PICK_WIDTH).heightIn(min = PICK_HEIGHT).then(pick), contentAlignment = Alignment.Center) {
                        MutedMark(isPicked)
                    }
                }

                0 -> {
                    Box(Modifier.width(PICK_WIDTH).heightIn(min = PICK_HEIGHT).then(pick), contentAlignment = Alignment.Center) {
                        OpenMark(isPicked)
                    }
                }

                else -> {
                    FretCell(isFirst = column == 2, firstFret = firstFret, minHeight = PICK_HEIGHT, modifier = pick) {
                        if (isPicked) NoteMark(markOf(string), nameOf(Guitar.noteMidi(string, fret)))
                    }
                }
            }
        }
    }
}

/** One fret of one string: the string runs across it, the fret wire closes it, and the window's first fret starts at the nut. */
@Composable
private fun RowScope.FretCell(
    isFirst: Boolean,
    firstFret: Int,
    minHeight: Dp,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val string = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = STRING_ALPHA)
    val wire = MaterialTheme.colorScheme.outlineVariant
    val nut = MaterialTheme.colorScheme.onSurface

    Box(
        Modifier
            .weight(1f)
            .heightIn(min = minHeight)
            .drawBehind {
                drawLine(string, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), 1.dp.toPx())
                drawWire(wire, size.width, 2.dp)
                if (isFirst) drawWire(if (firstFret == 1) nut else wire, 0f, if (firstFret == 1) 4.dp else 2.dp)
            }.then(modifier),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

private fun DrawScope.drawWire(
    color: Color,
    x: Float,
    width: Dp,
) {
    val stroke = width.toPx()
    val center = x.coerceIn(stroke / 2, size.width - stroke / 2)
    drawLine(color, Offset(center, 0f), Offset(center, size.height), stroke)
}

@Composable
private fun MutedMark(isPicked: Boolean) {
    val color = MaterialTheme.colorScheme.onSurfaceVariant
    Text(
        MUTED,
        color = if (isPicked) MaterialTheme.colorScheme.onSurface else color.copy(alpha = FAINT_ALPHA),
        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
    )
}

@Composable
private fun OpenMark(isPicked: Boolean) {
    val colors = MaterialTheme.colorScheme
    val size = with(LocalDensity.current) { OPEN_SIZE.toDp() }
    Box(
        Modifier
            .size(size)
            .background(if (isPicked) colors.onSurface.copy(alpha = OPEN_FILL_ALPHA) else Color.Transparent, CircleShape)
            .border(2.dp, if (isPicked) colors.onSurface else colors.onSurfaceVariant.copy(alpha = OPEN_FAINT_ALPHA), CircleShape),
    )
}

private const val MUTED = "×"
private const val STRING_ALPHA = 0.5f
private const val FAINT_ALPHA = 0.4f
private const val OPEN_FILL_ALPHA = 0.1f
private const val OPEN_FAINT_ALPHA = 0.3f
private val NAME_WIDTH = 20.sp
private val OPEN_SIZE = 14.sp
private val INDICATOR_WIDTH = 32.dp
private val PICK_WIDTH = 48.dp
private val PICK_HEIGHT = 48.dp
private val SHOWN_HEIGHT = 32.dp
