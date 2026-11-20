package com.zoonk.android.feature.tutor

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import com.zoonk.android.R
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.api.models.LearnerSummary

/** The buddy the learner talks to; before the summary arrives it's "Your buddy", without a face. */
@Immutable
data class TutorIdentity(
    val name: String,
    val look: BuddyLook?,
) {
    val prompt: TutorPrompt get() = TutorPrompt(name.takeIf { look != null })
}

@Composable
fun tutorIdentity(summary: LearnerSummary?): TutorIdentity {
    val buddy = summary?.buddy ?: return TutorIdentity(stringResource(R.string.tutor_your_buddy), look = null)
    return TutorIdentity(buddyName(BuddyKind.of(buddy.kind.value), buddy.name), buddy.look())
}

/** "Ask Sam about this chapter", or "Ask for help" before the buddy is known: a stand-in name never sits in a sentence. */
@Composable
fun TutorIdentity.askText(
    @StringRes named: Int = R.string.tutor_ask,
): String = if (prompt.asksForHelp) stringResource(R.string.tutor_ask_for_help) else stringResource(named, name)

/** Its face, still: the conversation only illustrates it here. */
@Composable
fun TutorAvatar(
    identity: TutorIdentity,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    identity.look?.let { Buddy(it, modifier.size(size), crop = BuddyCrop.Face) }
}
