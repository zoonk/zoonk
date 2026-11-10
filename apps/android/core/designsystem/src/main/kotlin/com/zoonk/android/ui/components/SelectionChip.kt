package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

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
        leadingIcon =
            if (selected) {
                { Icon(painterResource(R.drawable.ic_check), contentDescription = null, Modifier.size(FilterChipDefaults.IconSize)) }
            } else {
                null
            },
        colors =
            FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.zoonk.selectedTint,
                selectedLabelColor = colors.onSurface,
                selectedLeadingIconColor = colors.onSurface,
            ),
        border =
            FilterChipDefaults.filterChipBorder(
                enabled = enabled,
                selected = selected,
                borderColor = colors.outline,
                selectedBorderColor = colors.primary,
                selectedBorderWidth = 2.dp,
            ),
    )
}
