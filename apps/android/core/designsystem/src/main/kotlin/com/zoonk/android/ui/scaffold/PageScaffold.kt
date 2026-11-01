package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PageScaffold(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            // Across an unfolded book's fold the title ends at the fold. The actions keep their slot at the bar's end, past
            // the fold, so what they opened stays open as the book folds.
            TopAppBar(
                title = { BeforeFold { beforeFold -> Box(beforeFold) { title() } } },
                navigationIcon = { BackButton(onClick = onBack) },
                actions = actions,
            )
        },
        content = content,
    )
}
