package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.withTabularFigures

@Composable
fun LessonSummaryIdeas(
    ideas: List<String>,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()

    Column(modifier) {
        ideas.forEachIndexed { index, idea ->
            if (index > 0) HorizontalDivider()
            Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = formatNumber((index + 1).toDouble(), locale),
                    modifier = Modifier.clearAndSetSemantics {},
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
                )
                RichInlineText(text = idea, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}
