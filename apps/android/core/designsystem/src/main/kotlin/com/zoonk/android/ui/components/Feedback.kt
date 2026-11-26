package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

enum class FeedbackTone { Almost, Neutral, Right, Wrong }

/**
 * What a checked answer got (main's `FeedbackPanel`), under the question so it stays in view. It scrolls itself into
 * sight as it appears, unless its screen does that itself ([LocalOwnFeedbackReveal]).
 */
@Composable
fun FeedbackPanel(
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val reveal = if (LocalOwnFeedbackReveal.current) Modifier else Modifier.revealWhenShown()
    OutlinedCard(modifier.fillMaxWidth().then(reveal).semantics { paneTitle = label }) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

/** The verdict's words, which TalkBack reads as soon as they appear; [end] is a quiet fact beside them. */
@Composable
fun FeedbackVerdict(
    text: String,
    tone: FeedbackTone,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
    end: String? = null,
) {
    val color = tone.color()
    val style = MaterialTheme.zoonkType.verdict
    val glyph = with(LocalDensity.current) { style.lineHeight.toDp() }
    val line =
        with(LocalDensity.current) {
            rememberTextMeasurer()
                .measure("A", style)
                .size.height
                .toDp()
        }

    Row(
        modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Row(Modifier.weight(1f).alignByBaseline(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // The box ends where the glyph does, so its ink sits as close to the words as main's.
            Box(Modifier.height(line), contentAlignment = Alignment.CenterStart) {
                Icon(
                    painter = painterResource(icon ?: tone.glyph()),
                    contentDescription = null,
                    modifier = Modifier.glyphInk(icon ?: tone.glyph()).size(glyph),
                    tint = color,
                )
            }
            Text(text = text, modifier = Modifier.alignByBaseline(), color = color, style = style)
        }
        if (end != null) {
            Text(
                text = end,
                modifier = Modifier.alignByBaseline(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

/** A quiet last line under the verdict: where the question goes next. */
@Composable
fun FeedbackNote(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text = text, modifier = modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun FeedbackTone.color(): Color =
    when (this) {
        FeedbackTone.Almost -> MaterialTheme.zoonk.warningText
        FeedbackTone.Neutral -> MaterialTheme.colorScheme.onSurface
        FeedbackTone.Right -> MaterialTheme.colorScheme.onTertiaryContainer
        FeedbackTone.Wrong -> MaterialTheme.colorScheme.error
    }

@DrawableRes
private fun FeedbackTone.glyph(): Int =
    when (this) {
        FeedbackTone.Right -> R.drawable.ic_check
        FeedbackTone.Neutral -> R.drawable.ic_remove
        FeedbackTone.Almost, FeedbackTone.Wrong -> R.drawable.ic_close
    }
