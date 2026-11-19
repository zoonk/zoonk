package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.markSize

/** How many rows follow the next one before "+N more" folds the rest, on Today and the plan's reveal. */
const val UPCOMING_ROWS = 4

/** Today's fold row: the day's later rows behind one line, also used by the plan's reveal. */
@Composable
fun FoldRow(
    label: String,
    done: Boolean,
    open: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(MaterialTheme.shapes.medium)
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics {
                    if (open) {
                        collapse { onToggle().let { true } }
                    } else {
                        expand { onToggle().let { true } }
                    }
                }.heightIn(min = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { if (done) DoneMark() }
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleSmall)
            Icon(
                painter = painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(18.dp).rotate(if (open) 180f else 0f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
