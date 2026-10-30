package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp

/** Main's `PageEyebrow`: the small line above a page's title. */
@Composable
fun Eyebrow(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
) {
    Text(text = text, modifier = modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

@Composable
fun Eyebrow(
    text: String,
    modifier: Modifier = Modifier,
) {
    Eyebrow(AnnotatedString(text), modifier)
}

/** Main's `SuccessEyebrow`: an eyebrow saying something is done. */
@Composable
fun SuccessEyebrow(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        DoneMark()
        Text(text = text, color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.titleSmall)
    }
}
