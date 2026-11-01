package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

/**
 * For what stays one column across an unfolded book foldable's fold yet holds a field or a button,
 * such as search, a status message or a goal box without examples: it keeps to the page before the
 * fold. [content] gets the width to keep to, which ends at the fold, and no limit where no fold
 * crosses the page; [modifier] lays out the whole width, as it would the content's.
 */
@Composable
fun BeforeFold(
    modifier: Modifier = Modifier,
    content: @Composable (beforeFold: Modifier) -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(modifier.fillMaxWidth().onPageSpan { span = it }) {
        content(pageFold(maxWidth, span)?.let { Modifier.widthIn(max = it.start) } ?: Modifier)
    }
}
