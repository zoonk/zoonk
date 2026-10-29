package com.zoonk.android.ui.characters

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.theme.ZoonkMotion

typealias TricksterActorState = ActorState<TricksterExpression, TricksterAct>

@Composable
fun rememberTricksterActorState(): TricksterActorState = rememberActorState(TricksterActing)

/** The Trickster, still: in marks, rows and the roadmap. */
@Composable
fun Trickster(
    modifier: Modifier = Modifier,
    expression: TricksterExpression = TricksterExpression.Sly,
    label: String? = null,
) {
    val drawing = remember { TricksterDrawing(holdsSign = false) }
    CharacterStill(drawing, expression, label, modifier)
}

/**
 * A challenge's Trickster: he holds his sign until he's beaten. `reacts` on its intro and result:
 * smug, or defeated when beaten, a beat in, and drawn still where the moment doesn't play
 * (`CelebrationScope`). In a duel, `state.play(act, event)` reacts to each verdict.
 */
@Composable
fun TricksterArt(
    modifier: Modifier = Modifier,
    beaten: Boolean = false,
    reacts: Boolean = false,
    state: TricksterActorState = rememberTricksterActorState(),
    label: String? = null,
) {
    val drawing = remember(beaten) { TricksterDrawing(holdsSign = !beaten) }
    val reaction = if (reacts) ActReaction(if (beaten) TricksterAct.Defeat else TricksterAct.Smug, ZoonkMotion.BEAT_MILLIS) else null
    val expression = if (beaten && !reacts) TricksterExpression.Defeated else TricksterExpression.Sly

    CharacterActor(drawing, expression, reaction, state, label, modifier)
}
