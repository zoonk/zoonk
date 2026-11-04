package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.CelebrationScope

/**
 * A result as the shared foldables rule lays it out, as two pages where [spreadFold] splits the
 * screen and one column elsewhere. [done] goes before the split: the title, its detail, the saving
 * or failed line and the numbers. [next] goes after it, above the docked way on: the day's moment
 * and what's next. A result with nothing for [next] still splits rather than spanning the fold.
 * Every page reads in [columnModifier], the caller's own column width, so a screen keeps its edges
 * without a split. [withMoment] is whether the moment is on screen yet, which waits for the save.
 */
@Composable
fun ResultPages(
    modifier: Modifier = Modifier,
    withMoment: Boolean,
    columnModifier: Modifier,
    done: @Composable ColumnScope.() -> Unit,
    next: @Composable ColumnScope.() -> Unit,
) {
    // The moment plays once: made again after a fold or a rotation, the result shows it as it finished.
    var played by rememberSaveable { mutableStateOf(false) }
    val plays = remember { !played }
    SideEffect { if (withMoment) played = true }
    // The one column keeps its own scroll, so folding back finds it where the learner left it.
    val scroll = rememberScrollState()
    val doneScroll = rememberScrollState()
    val nextScroll = rememberScrollState()
    var span by remember { mutableStateOf<PageSpan?>(null) }

    CelebrationScope(play = plays) {
        BoxWithConstraints(modifier.fillMaxSize().onPageSpan { span = it }) {
            val fold = spreadFold(maxWidth, span)

            if (fold == null) {
                ResultPage(Modifier.fillMaxSize(), scroll, Alignment.CenterHorizontally, columnModifier) {
                    done()
                    next()
                }
            } else {
                ResultPage(
                    Modifier.width(fold.start).fillMaxHeight().semantics { isTraversalGroup = true },
                    doneScroll,
                    Alignment.End,
                    columnModifier,
                    done,
                )
                ResultPage(
                    Modifier.fillMaxSize().padding(start = fold.end).semantics { isTraversalGroup = true },
                    nextScroll,
                    Alignment.Start,
                    columnModifier,
                    next,
                )
            }
        }
    }
}

@Composable
private fun ResultPage(
    modifier: Modifier,
    scroll: ScrollState,
    align: Alignment.Horizontal,
    columnModifier: Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .verticalScroll(scroll)
            .padding(vertical = 24.dp)
            .wrapContentWidth(align)
            .then(columnModifier),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        content = content,
    )
}
