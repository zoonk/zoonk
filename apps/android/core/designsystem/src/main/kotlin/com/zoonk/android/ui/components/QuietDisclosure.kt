package com.zoonk.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's `QuietDisclosure`: a small text button under a line that opens what most learners don't
 * need, such as every change a plan change makes. It starts on the text edge of the lines above it.
 */
@Composable
fun QuietDisclosure(
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val state = stringResource(if (open) R.string.disclosure_expanded else R.string.disclosure_collapsed)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column(modifier) {
        Row(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(MaterialTheme.shapes.small)
                    .clickable(role = Role.Button) { open = !open }
                    .semantics(mergeDescendants = true) {
                        stateDescription = state
                        if (open) {
                            collapse {
                                open = false
                                true
                            }
                        } else {
                            expand {
                                open = true
                                true
                            }
                        }
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = muted)
            Icon(
                painter = painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(16.dp).rotate(if (open) 180f else 0f),
                tint = muted,
            )
        }
        if (open) content()
    }
}
