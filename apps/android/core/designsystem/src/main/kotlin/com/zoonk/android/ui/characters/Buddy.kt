package com.zoonk.android.ui.characters

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import com.zoonk.android.ui.components.color

typealias BuddyActorState = ActorState<BuddyExpression, BuddyAct>

@Composable
fun rememberBuddyActorState(): BuddyActorState = rememberActorState(BuddyActing)

/**
 * The buddy, still: where it only illustrates a screen or is small (the navigation, Today, rows,
 * marks, pickers, empty states). `Face` crops to its face for icon sizes. Omit `label` only when
 * words beside it already name the buddy.
 */
@Composable
fun Buddy(
    look: BuddyLook,
    modifier: Modifier = Modifier,
    expression: BuddyExpression = look.everydayExpression,
    crop: BuddyCrop = BuddyCrop.Whole,
    label: String? = null,
) {
    CharacterStill(rememberBuddyDrawing(look, crop), expression, label, modifier)
}

/**
 * Main's `fit="ink"`: the whole buddy framed by its drawn outline, at the scale a body [height] tall
 * draws it, so short and tall buddies stand at their own heights with nothing floating in its box.
 */
@Composable
fun StandingBuddy(
    look: BuddyLook,
    height: Dp,
    modifier: Modifier = Modifier,
) {
    val ink = look.bodyInk
    Buddy(look, modifier.size(height * (ink.width / BODY_BOX_HEIGHT), height * (ink.height / BODY_BOX_HEIGHT)), crop = BuddyCrop.Ink)
}

/**
 * The buddy where something happened: `reaction` plays once as the moment plays (a mission done, the
 * summary, a ceremony) and is drawn in its landing where it doesn't (`CelebrationScope`); `state.play`
 * reacts on cue (its chat).
 */
@Composable
fun BuddyActor(
    look: BuddyLook,
    modifier: Modifier = Modifier,
    expression: BuddyExpression = look.everydayExpression,
    crop: BuddyCrop = BuddyCrop.Whole,
    reaction: ActReaction<BuddyAct>? = null,
    state: BuddyActorState = rememberBuddyActorState(),
    label: String? = null,
) {
    CharacterActor(rememberBuddyDrawing(look, crop), expression, reaction, state, label, modifier)
}

@Composable
private fun rememberBuddyDrawing(
    look: BuddyLook,
    crop: BuddyCrop,
): BuddyDrawing {
    val belt = look.belt.color
    return remember(look, crop, belt) { BuddyDrawing(look, crop, belt) }
}
