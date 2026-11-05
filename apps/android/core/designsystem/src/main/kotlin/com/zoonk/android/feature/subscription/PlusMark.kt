package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import com.zoonk.android.R
import com.zoonk.android.ui.components.LabelChip

/** Main's quiet Plus chip; [label] is what TalkBack reads, "Available with Plus" unless it says otherwise. */
@Composable
fun PlusMark(
    modifier: Modifier = Modifier,
    label: String = stringResource(R.string.subscription_available_with_plus),
) {
    LabelChip(
        text = stringResource(R.string.subscription_plus),
        modifier = modifier.clearAndSetSemantics { contentDescription = label },
    )
}

/** [PlusMark] after a button's label, drawn in the button's content color as main's is. */
@Composable
fun ButtonPlusMark() {
    val color = LocalContentColor.current
    MaterialTheme(colorScheme = MaterialTheme.colorScheme.copy(onSurfaceVariant = color, outline = color.copy(alpha = EDGE_ALPHA))) {
        PlusMark(Modifier.padding(start = ButtonDefaults.IconSpacing))
    }
}

private const val EDGE_ALPHA = 0.5f
