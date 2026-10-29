package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.richtext.RichText

@Immutable
data class LessonSummary(
    val title: String,
    val ideas: List<String>,
)

@Composable
fun LessonSummaries(
    summaries: List<LessonSummary>,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        summaries.forEach { summary ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(summary.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurfaceVariant) {
                    summary.ideas.forEach { idea ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(BULLET, Modifier.clearAndSetSemantics {}, style = MaterialTheme.typography.bodyMedium)
                            RichText(idea, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

private const val BULLET = "•"
