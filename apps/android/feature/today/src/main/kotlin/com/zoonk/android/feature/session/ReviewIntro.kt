package com.zoonk.android.feature.session

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.core.content.edit
import com.zoonk.android.R
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.bleed
import com.zoonk.api.models.StudyBlock
import java.util.UUID

/**
 * The reviews started on this device, kept on it as main keeps them in the browser, and counted per
 * goal, so a learner sharing the device starts with how reviews work open.
 */
internal class ReviewStarts(
    context: Context,
) {
    private val preferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** A daily learner reads how reviews work open a few times, then it folds to one row they can reopen. */
    fun openAtFirst(goalId: UUID?): Boolean = goalId == null || preferences.getInt(key(goalId), 0) < OPEN_FOR_STARTS

    fun note(
        step: DayStep,
        goalId: UUID,
    ) {
        if (step.hasCapsules) preferences.edit { putInt(key(goalId), preferences.getInt(key(goalId), 0) + 1) }
    }

    private fun key(goalId: UUID) = "review_intro_starts:$goalId"

    private companion object {
        const val FILE = "session"
        const val OPEN_FOR_STARTS = 3
    }
}

@Composable
internal fun rememberReviewStarts(): ReviewStarts {
    val context = LocalContext.current
    return remember(context) { ReviewStarts(context) }
}

private val DayStep.hasCapsules: Boolean
    get() = kind == StudyBlock.Kind.REVIEW && capsules.isNotEmpty()

/** What a review is and how it picks its questions, for a learner who never asked. */
@Composable
internal fun ReviewIntro(
    step: DayStep,
    openAtFirst: Boolean,
    modifier: Modifier = Modifier,
) {
    if (step.kind != StudyBlock.Kind.REVIEW) return

    // The first week's warm-up is only placement's questions: it checks, it doesn't review.
    if (!step.hasCapsules) {
        Text(
            stringResource(R.string.session_review_intro_first_week),
            modifier,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }

    var expanded by rememberSaveable(step.position) { mutableStateOf(openAtFirst) }

    DisclosureRow(
        title = stringResource(R.string.session_review_intro_title),
        expanded = expanded,
        onExpandedChange = { expanded = it },
        leading = { Icon(painterResource(LearnKind.Review.icon), contentDescription = null) },
        modifier = modifier.bleed(LIST_ITEM_INSET),
    ) {
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            if (step.weakest) {
                IntroRow(
                    R.drawable.ic_target,
                    stringResource(R.string.session_review_intro_weakest_title),
                    stringResource(R.string.session_review_intro_weakest),
                )
            } else {
                IntroRow(
                    R.drawable.ic_hourglass_bottom,
                    stringResource(R.string.session_review_intro_forget_title),
                    stringResource(R.string.session_review_intro_forget),
                )
            }
            ListDivider()
            IntroRow(
                R.drawable.ic_event_upcoming,
                stringResource(R.string.session_review_intro_spacing_title),
                stringResource(R.string.session_review_intro_spacing),
            )
            ListDivider()
            IntroRow(
                R.drawable.ic_timer,
                stringResource(R.string.session_review_intro_short_title),
                stringResource(R.string.session_review_intro_short),
            )
        }
    }
}

@Composable
private fun IntroRow(
    @DrawableRes icon: Int,
    title: String,
    description: String,
) {
    ListRow(
        headline = { Text(title) },
        leading = { Icon(painterResource(icon), contentDescription = null) },
        supporting = { Text(description) },
        verticalAlignment = Alignment.Top,
    )
}
