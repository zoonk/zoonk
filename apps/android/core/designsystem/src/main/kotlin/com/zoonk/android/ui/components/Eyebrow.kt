package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.toUpperCase
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

/** Main's `PageEyebrow`: the small line above a page's title, uppercase for the eye and as written for TalkBack. */
@Composable
fun Eyebrow(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.toUpperCase(LocaleList.current),
        modifier = modifier.clearAndSetSemantics { this.text = text },
        color = MaterialTheme.zoonk.faint,
        style = MaterialTheme.zoonkType.eyebrow,
    )
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
        Text(
            text = text,
            color = MaterialTheme.colorScheme.onTertiaryContainer,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
        )
    }
}
