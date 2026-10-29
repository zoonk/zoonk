package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/** Main's `StatTone`: what a tile's symbol is colored by. */
enum class StatTone { Neutral, Success, Energy, Brain }

val StatTone.color: Color
    @Composable
    @ReadOnlyComposable
    get() =
        when (this) {
            StatTone.Neutral -> MaterialTheme.colorScheme.onSurfaceVariant
            StatTone.Success -> MaterialTheme.colorScheme.tertiary
            StatTone.Energy -> MaterialTheme.zoonk.energy
            StatTone.Brain -> MaterialTheme.zoonk.brain
        }

/**
 * Main's `StatTile`: a label with its symbol, a number and a line about it, read by TalkBack as one.
 * [spokenValue] is what TalkBack says for a value written for the eye, such as "45 of 60" for "45/60".
 */
@Composable
fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    tone: StatTone = StatTone.Neutral,
    icon: (@Composable (Modifier) -> Unit)? = null,
    onClick: (() -> Unit)? = null,
    spokenValue: String? = null,
    footer: (@Composable () -> Unit)? = null,
) {
    val content = @Composable {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                icon?.invoke(
                    Modifier.size(
                        with(LocalDensity.current) {
                            MaterialTheme.typography.labelLarge.fontSize
                                .toDp()
                        },
                    ),
                )
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            }
            val style =
                MaterialTheme.typography.headlineSmall.copy(
                    color = if (tone == StatTone.Brain) MaterialTheme.zoonk.brainText else MaterialTheme.colorScheme.onSurface,
                )
            val spoken = spokenValue?.let { Modifier.semantics { contentDescription = it } } ?: Modifier
            // Main's `BigQuantity` for a quantity ("40 Brain Power", "2 days"), its words smaller; other values whole.
            if (value.any(Char::isDigit)) {
                Readout(value, spoken, style)
            } else {
                Text(value, spoken, style = style.withTabularFigures().copy(fontWeight = FontWeight.SemiBold))
            }
            detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
            footer?.invoke()
        }
    }

    if (onClick == null) {
        OutlinedCard(modifier.semantics(mergeDescendants = true) {}) { content() }
    } else {
        OutlinedCard(onClick = onClick, modifier = modifier) { content() }
    }
}

/** Main's `StatTiles`: up to [columns] to a row, fewer when larger text leaves a tile too narrow, a last lone tile across the row. */
@Composable
fun StatTiles(
    columns: Int,
    tiles: List<@Composable (Modifier) -> Unit>,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val narrowest = MIN_TILE_WIDTH * LocalDensity.current.fontScale
        val fitting = ((maxWidth + TILE_GAP) / (narrowest + TILE_GAP)).toInt().coerceIn(1, columns)

        Column(verticalArrangement = Arrangement.spacedBy(TILE_GAP)) {
            tiles.chunked(fitting).forEach { row ->
                Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(TILE_GAP)) {
                    row.forEach { tile -> tile(Modifier.weight(1f).fillMaxHeight()) }
                }
            }
        }
    }
}

private val MIN_TILE_WIDTH = 120.dp
private val TILE_GAP = 8.dp
