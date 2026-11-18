package com.zoonk.android.ui.components

import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.zoonk

/**
 * A pick among a few short answers, picked as main's toggles and the week's days are: an ink line on the picked
 * tint, with no check, so every picked option on a screen reads one way.
 */
@Composable
fun SelectionChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    role: Role? = null,
    enabled: Boolean = true,
) {
    val colors = MaterialTheme.colorScheme

    FilterChip(
        selected = selected,
        onClick = onClick,
        enabled = enabled,
        label = { Text(text) },
        modifier = if (role != null) modifier.semantics { this.role = role } else modifier,
        colors =
            FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.zoonk.selectedTint,
                selectedLabelColor = colors.onSurface,
                // While a save runs, the pick stays drawn, as a weekday's does.
                disabledSelectedContainerColor = MaterialTheme.zoonk.selectedTint,
            ),
        border =
            FilterChipDefaults.filterChipBorder(
                enabled = enabled,
                selected = selected,
                borderColor = colors.outline,
                selectedBorderColor = colors.primary,
                disabledSelectedBorderColor = colors.primary,
                selectedBorderWidth = 2.dp,
            ),
    )
}
