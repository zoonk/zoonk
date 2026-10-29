package com.zoonk.android.feature.onboarding.start

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.goalErrorMessage
import com.zoonk.android.feature.onboarding.goalLimitMessage

@Composable
internal fun OnboardingHeading(
    title: String,
    description: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        if (description != null) {
            Text(text = description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
internal fun TypedGoal(goal: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Surface(
            modifier = Modifier.widthIn(max = 480.dp),
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 4.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
        ) {
            Text(
                text = goal,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
internal fun OutcomeIcon(
    @DrawableRes icon: Int,
) {
    Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
internal fun OnboardingActions(content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
internal fun CreateAccountButton(onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_create_account)) }
}

/** Main's `GoalErrorAlert`: an account asks for one, a Plus limit says what Plus lifts, anything else in words. */
@Composable
internal fun GoalErrorAlert(
    error: GoalError?,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    error ?: return
    val alert = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    val limit = (error as? GoalError.Limit)?.reason

    when {
        limit != null && limit.isPlusLimit -> {
            GoalLimitNotice(limit, upFront = false, onOpenPlan = onOpenPlan, modifier = alert)
        }

        error.needsAccount -> {
            Column(alert, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(goalErrorMessage(error), style = MaterialTheme.typography.bodyLarge)
                CreateAccountButton(onCreateAccount)
            }
        }

        else -> {
            Text(
                goalErrorMessage(error),
                modifier = alert,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** Main's `GoalFooter`: a goal that needs an account offers only that. */
@Composable
internal fun GoalFooter(
    error: GoalError?,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
    actions: @Composable ColumnScope.() -> Unit,
) {
    if (error?.needsAccount == true) {
        OnboardingActions { GoalErrorAlert(error, onCreateAccount, onOpenPlan) }
        return
    }
    GoalErrorAlert(error, onCreateAccount, onOpenPlan)
    OnboardingActions(actions)
}

/** Shown only for limits Plus lifts. */
@Composable
internal fun GoalLimitNotice(
    reason: GoalLimitReason,
    upFront: Boolean,
    onOpenPlan: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!reason.isPlusLimit) return

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(R.drawable.ic_lock), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (reason == GoalLimitReason.OneActiveGoal) {
                    Text(stringResource(R.string.onboarding_plus_more_goals), style = MaterialTheme.typography.titleSmall)
                }
                Text(
                    text =
                        if (upFront && reason == GoalLimitReason.OneActiveGoal) {
                            stringResource(R.string.onboarding_plus_more_goals_up_front)
                        } else {
                            goalLimitMessage(reason)
                        },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (reason == GoalLimitReason.OneActiveGoal) {
                    OutlinedButton(onClick = onOpenPlan, modifier = Modifier.padding(top = 8.dp)) {
                        Text(stringResource(R.string.onboarding_go_to_plan))
                    }
                }
            }
        }
    }
}

/** In place of confirming, when Plus is what lifts the limit. */
@Composable
internal fun GoalLimitWall(
    reason: GoalLimitReason,
    onSeePlus: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    OnboardingActions {
        Text(
            text = goalLimitMessage(reason),
            modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(onClick = onSeePlus, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_see_plus)) }
        if (reason == GoalLimitReason.OneActiveGoal) {
            OutlinedButton(
                onClick = onOpenPlan,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(R.string.onboarding_go_to_plan)) }
        }
    }
}

/** Right after sending, it opens by itself; coming back later it waits for a tap, since writing it is new work. */
@Composable
internal fun ExplainGoal(
    goal: String,
    question: String,
    isStarting: Boolean,
    error: GoalError?,
    onStart: () -> Unit,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_lightbulb)
    OnboardingHeading(question, stringResource(R.string.onboarding_explain_description))
    GoalFooter(error, onCreateAccount, onOpenPlan) {
        Button(onClick = onStart, enabled = !isStarting, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(if (isStarting) R.string.onboarding_opening_explanation else R.string.onboarding_explain_it))
        }
    }
}

@Composable
internal fun DeclinedGoal(
    goal: String,
    onRetry: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_volunteer_activism)
    OnboardingHeading(stringResource(R.string.onboarding_declined_title), stringResource(R.string.onboarding_declined_description))
    OnboardingActions {
        Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_try_another_goal)) }
    }
}

@Composable
internal fun UnclearGoal(
    goal: String,
    onRetry: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_contact_support)
    OnboardingHeading(stringResource(R.string.onboarding_unclear_title), stringResource(R.string.onboarding_unclear_description))
    OnboardingActions {
        Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_write_again)) }
    }
}

@Composable
internal fun InstrumentGoal(
    goal: String,
    instrument: String,
    isStarting: Boolean,
    error: GoalError?,
    waitlist: WaitlistOutcome?,
    isJoining: Boolean,
    onStartMusicianship: () -> Unit,
    onJoinWaitlist: () -> Unit,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_music_note)
    OnboardingHeading(
        stringResource(R.string.onboarding_instrument_title, instrument),
        stringResource(R.string.onboarding_instrument_description),
    )
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(R.drawable.ic_music_note), contentDescription = null, modifier = Modifier.size(20.dp))
            Text(stringResource(R.string.onboarding_musicianship_card, instrument), style = MaterialTheme.typography.bodyMedium)
        }
    }

    val status = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    when (waitlist) {
        WaitlistOutcome.Joined -> {
            Text(
                stringResource(R.string.onboarding_waitlist_joined),
                modifier = status,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        WaitlistOutcome.SignInRequired -> {
            Column(status) {
                Text(
                    stringResource(R.string.onboarding_waitlist_sign_in),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(onClick = onCreateAccount) { Text(stringResource(R.string.onboarding_create_account_short)) }
            }
        }

        WaitlistOutcome.Failed -> {
            Text(
                stringResource(R.string.onboarding_save_failed),
                modifier = status,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        null -> {}
    }

    GoalFooter(error, onCreateAccount, onOpenPlan) {
        Button(onClick = onStartMusicianship, enabled = !isStarting, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(if (isStarting) R.string.onboarding_saving_goal else R.string.onboarding_start_musicianship))
        }
        FilledTonalButton(
            onClick = onJoinWaitlist,
            enabled = !isJoining && waitlist != WaitlistOutcome.Joined,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.onboarding_join_waitlist)) }
    }
}

@Composable
internal fun GuestGoalGate(
    onCreateAccount: () -> Unit,
    onBackToToday: () -> Unit,
) {
    OutcomeIcon(R.drawable.ic_person_add)
    OnboardingHeading(stringResource(R.string.onboarding_guest_gate_title), stringResource(R.string.onboarding_guest_gate_description))
    OnboardingActions {
        CreateAccountButton(onCreateAccount)
        TextButton(onClick = onBackToToday, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_back_to_today)) }
    }
}
