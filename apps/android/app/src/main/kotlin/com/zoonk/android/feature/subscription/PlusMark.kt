package com.zoonk.android.feature.subscription

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
