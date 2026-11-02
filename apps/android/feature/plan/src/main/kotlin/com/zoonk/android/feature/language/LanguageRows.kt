package com.zoonk.android.feature.language

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DOT_SHARE
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.theme.zoonk

/** Decorative: its line says what the learner can do. */
@Composable
fun CanDoMark(
    done: Boolean,
    modifier: Modifier = Modifier,
) {
    val fill = MaterialTheme.colorScheme.tertiary
    val ring = MaterialTheme.colorScheme.onSurfaceVariant

    Canvas(modifier.size(markSize())) {
        val radius = size.minDimension * DOT_SHARE / 2
        if (done) {
            drawCircle(fill, radius)
        } else {
            val width = RING.toPx()
            drawCircle(ring, radius - width / 2, style = Stroke(width))
        }
    }
}

@Composable
fun PatternRow(
    typos: Boolean,
    title: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ListItem(
        headlineContent = { Text(stringResource(if (typos) R.string.language_pattern_typos else R.string.language_pattern_noticed)) },
        modifier = modifier.clickable(onClick = onOpen),
        supportingContent = { Text(if (typos) stringResource(R.string.language_pattern_typos_description) else title) },
        leadingContent = {
            Icon(
                painterResource(if (typos) R.drawable.ic_keyboard else R.drawable.ic_auto_awesome),
                contentDescription = null,
                tint = if (typos) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.zoonk.warning,
            )
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}

@Composable
fun PronunciationRow(
    count: Int,
    words: List<String>,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ListItem(
        headlineContent = { Text(pluralStringResource(R.plurals.language_say_again, count, count)) },
        modifier = modifier.clickable(onClick = onOpen),
        supportingContent = { Text(formatList(words, currentLocale()), maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingContent = { Icon(painterResource(R.drawable.ic_mic), contentDescription = null) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}

private val RING = 1.5.dp
