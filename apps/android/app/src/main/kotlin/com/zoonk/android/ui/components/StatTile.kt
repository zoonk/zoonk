package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
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

/** Main's `StatTile`: a label with its symbol, a number and a line about it, read by TalkBack as one. */
@Composable
fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    tone: StatTone = StatTone.Neutral,
    icon: (@Composable (Modifier) -> Unit)? = null,
    onClick: (() -> Unit)? = null,
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
                Text(
                    label,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                value,
                color = if (tone == StatTone.Brain) MaterialTheme.zoonk.brainText else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.headlineSmall.withTabularFigures(),
            )
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

/** Main's `StatTiles`: [columns] to a row, a last lone tile across the row. */
@Composable
fun StatTiles(
    columns: Int,
    tiles: List<@Composable (Modifier) -> Unit>,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(columns).forEach { row ->
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { tile -> tile(Modifier.weight(1f).fillMaxHeight()) }
            }
        }
    }
}
