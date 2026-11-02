package com.zoonk.android.ui.characters

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R

/** The name the learner gave the buddy, or its own name in the app's language. */
@Composable
@ReadOnlyComposable
fun buddyName(
    kind: BuddyKind,
    customName: String?,
): String =
    customName?.takeIf { it.isNotEmpty() } ?: stringResource(
        when (kind) {
            BuddyKind.Zu -> R.string.buddy_name_zu
            BuddyKind.Noodle -> R.string.buddy_name_noodle
            BuddyKind.Beep -> R.string.buddy_name_beep
            BuddyKind.Otto -> R.string.buddy_name_otto
        },
    )

@Composable
@ReadOnlyComposable
fun buddyStageName(stage: BuddyStage): String =
    stringResource(
        when (stage) {
            BuddyStage.Baby -> R.string.buddy_stage_baby
            BuddyStage.Young -> R.string.buddy_stage_young
            BuddyStage.Adult -> R.string.buddy_stage_adult
        },
    )
