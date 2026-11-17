package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

@Composable
fun InlineFailure(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier.semantics { liveRegion = LiveRegionMode.Polite }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            painterResource(R.drawable.ic_error),
            contentDescription = null,
            modifier = Modifier.glyphInk(R.drawable.ic_error).size(20.dp),
            tint = MaterialTheme.colorScheme.error,
        )
        Text(text, Modifier.weight(1f), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
    }
}
