package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics

/**
 * A page a tab or another page opened: its top bar with the way back, [title] and [actions]. A page
 * that leads its content with its title (`PageTitleRow`, as main's pages do) shows [title] in the bar
 * only once that heading scrolls under it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PageScaffold(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    val focus = rememberTitleFocus()

    Scaffold(
        modifier = Modifier.pageFocus(focus).then(modifier),
        topBar = {
            // Across an unfolded book's fold the title ends at the fold. The actions keep their slot at the bar's end, past
            // the fold, so what they opened stays open as the book folds.
            val inContent by remember(focus) { derivedStateOf { focus.headingInView() } }
            TopAppBar(
                title = {
                    BeforeFold { beforeFold ->
                        Box(
                            // Drawn by where the heading is in this frame, so the title doesn't flash in before the content lays out.
                            Modifier
                                .graphicsLayer { alpha = if (focus.headingInView()) 0f else 1f }
                                .then(if (inContent) Modifier.clearAndSetSemantics {} else Modifier)
                                .then(beforeFold.titleTarget(focus.bar)),
                        ) { title() }
                    }
                },
                modifier = Modifier.pageBar(focus),
                navigationIcon = { BackButton(onClick = onBack) },
                actions = actions,
            )
        },
        content = { padding -> CompositionLocalProvider(LocalTitleFocus provides focus) { content(padding) } },
    )
}
