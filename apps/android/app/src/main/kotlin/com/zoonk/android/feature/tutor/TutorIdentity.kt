package com.zoonk.android.feature.tutor

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
)

@Composable
internal fun tutorIdentity(summary: LearnerSummary?): TutorIdentity {
    val buddy = summary?.buddy ?: return TutorIdentity(stringResource(R.string.tutor_your_buddy), look = null)
    return TutorIdentity(buddyName(BuddyKind.of(buddy.kind.value), buddy.name), buddy.look())
}

/** Its face, still: the conversation only illustrates it here. */
@Composable
internal fun TutorAvatar(
    identity: TutorIdentity,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    identity.look?.let { Buddy(it, modifier.size(size), crop = BuddyCrop.Face) }
}
