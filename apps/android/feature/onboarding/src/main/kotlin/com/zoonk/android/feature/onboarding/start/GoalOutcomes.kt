package com.zoonk.android.feature.onboarding.start

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.goalErrorMessage
import com.zoonk.android.feature.onboarding.goalLimitMessage
import com.zoonk.android.feature.subscription.SubscribeGate
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.taskOption
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo
import com.zoonk.android.ui.theme.ZoonkRadius

@Composable
internal fun OnboardingHeading(
    title: String,
    description: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Each step swaps the whole screen: naming it as a pane makes TalkBack say which one arrived.
        Text(
            text = title,
            modifier = Modifier.pageTitle().semantics { paneTitle = title },
            style = MaterialTheme.typography.headlineMedium,
        )
        if (description != null) {
            Text(text = description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
internal fun TypedGoal(goal: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Surface(
            modifier = Modifier.widthIn(max = 480.dp),
            shape = RoundedCornerShape(topStart = ZoonkRadius.xl, topEnd = ZoonkRadius.xl, bottomStart = ZoonkRadius.xl, bottomEnd = 4.dp),
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
internal fun isCompactWidth(): Boolean =
    !windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)

@Composable
internal fun ColumnScope.OnboardingActions(content: @Composable ColumnScope.() -> Unit) {
    // Main pins them to the bottom on phones, within thumb reach; wider windows keep them under the content.
    if (isCompactWidth()) Spacer(Modifier.weight(1f))
    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
internal fun CreateAccountButton(onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.onboarding_create_account)) }
}

/** An account asks for one, a Plus limit says what Plus lifts, anything else in words. */
@Composable
internal fun GoalErrorAlert(
    error: GoalError?,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
    onSubscribe: () -> Unit,
) {
    error ?: return
    val alert = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    val limit = (error as? GoalError.Limit)?.reason

    when {
        limit != null && limit.isPlusLimit -> {
            GoalLimitNotice(limit, onOpenPlan = onOpenPlan, onSubscribe = onSubscribe, modifier = alert)
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

/** A goal that needs an account offers only that. */
@Composable
internal fun ColumnScope.GoalFooter(
    error: GoalError?,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
    onSubscribe: () -> Unit,
    actions: @Composable ColumnScope.() -> Unit,
) {
    if (error?.needsAccount == true) {
        OnboardingActions { GoalErrorAlert(error, onCreateAccount, onOpenPlan, onSubscribe) }
        return
    }
    GoalErrorAlert(error, onCreateAccount, onOpenPlan, onSubscribe)
    OnboardingActions(actions)
}

/** The gate a learner meets on trying to start a goal that only subscribing makes room for. */
@Composable
internal fun GoalLimitNotice(
    reason: GoalLimitReason,
    onOpenPlan: () -> Unit,
    onSubscribe: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!reason.isPlusLimit) return

    if (reason != GoalLimitReason.ActiveGoals) {
        SubscribeGate(
            title = stringResource(R.string.onboarding_month_goals_title),
            onSubscribe = onSubscribe,
            modifier = modifier,
            line = stringResource(R.string.onboarding_month_goals_line),
        )
        return
    }
    SubscribeGate(
        title = stringResource(R.string.onboarding_goals_at_once_title),
        onSubscribe = onSubscribe,
        modifier = modifier,
        line = stringResource(R.string.onboarding_goals_at_once_line),
        action = {
            OutlinedButton(onClick = onOpenPlan, size = ButtonSize.Small) { Text(stringResource(R.string.onboarding_go_to_plan)) }
        },
    )
}

/** In place of confirming, when only subscribing makes room for the goal. */
@Composable
internal fun ColumnScope.GoalLimitWall(
    reason: GoalLimitReason,
    onSubscribe: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    OnboardingActions {
        Text(
            text = goalLimitMessage(reason),
            modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        GoalLimitButtons(reason, onSubscribe, onOpenPlan)
    }
}

/** Main's `GoalLimitScreen`: at the goals-at-once limit, starting a goal is only the gate, its words as the heading and [GoalLimitBar] pinned under it. */
@Composable
internal fun GoalLimitScreen() {
    OnboardingHeading(stringResource(R.string.onboarding_goals_at_once_title), stringResource(R.string.onboarding_goals_at_once_line))
}

/** Main's `GoalLimitBar`, for the page's pinned bar: the Plan, where a goal can be paused, before Subscribe, the main action. */
@Composable
internal fun GoalLimitBar(
    onSubscribe: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    TaskActions(back = {
        OutlinedButton(onClick = onOpenPlan, modifier = Modifier.taskOption()) { Text(stringResource(R.string.onboarding_go_to_plan)) }
    }) { main ->
        Button(onClick = onSubscribe, modifier = main) { Text(stringResource(R.string.subscription_subscribe)) }
    }
}

/** Main's `GoalLimitBar`: the Plan, where a goal can be paused, before Subscribe, the main action. */
@Composable
private fun GoalLimitButtons(
    reason: GoalLimitReason,
    onSubscribe: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    if (reason == GoalLimitReason.ActiveGoals) {
        OutlinedButton(
            onClick = onOpenPlan,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.onboarding_go_to_plan)) }
    }
    Button(onClick = onSubscribe, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.subscription_subscribe)) }
}

/** Right after sending, it opens by itself; coming back later it waits for a tap, since writing it is new work. */
@Composable
internal fun ColumnScope.ExplainGoal(
    goal: String,
    question: String,
    isStarting: Boolean,
    error: GoalError?,
    onStart: () -> Unit,
    onCreateAccount: () -> Unit,
    onOpenPlan: () -> Unit,
    onSubscribe: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_lightbulb)
    OnboardingHeading(question, stringResource(R.string.onboarding_explain_description))
    GoalFooter(error, onCreateAccount, onOpenPlan, onSubscribe) {
        Button(
            busy = isStarting,
            onClick = onStart,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.onboarding_explain_it)) }
    }
}

@Composable
internal fun ColumnScope.DeclinedGoal(
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
internal fun ColumnScope.UnclearGoal(
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
internal fun ColumnScope.InstrumentGoal(
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
    onSubscribe: () -> Unit,
) {
    TypedGoal(goal)
    OutcomeIcon(R.drawable.ic_music_note)
    OnboardingHeading(
        stringResource(R.string.onboarding_instrument_title, instrument),
        stringResource(R.string.onboarding_instrument_description),
    )
    OutlinedCard {
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

    GoalFooter(error, onCreateAccount, onOpenPlan, onSubscribe) {
        Button(
            busy = isStarting,
            onClick = onStartMusicianship,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.onboarding_start_musicianship)) }
        TextButton(
            busy = isJoining,
            onClick = onJoinWaitlist,
            modifier = Modifier.fillMaxWidth(),
            enabled = waitlist != WaitlistOutcome.Joined,
            leadingIcon = { ButtonIcon(R.drawable.ic_notifications) },
        ) { Text(stringResource(R.string.onboarding_join_waitlist)) }
    }
}

@Composable
internal fun GuestGoalGate() {
    OutcomeIcon(R.drawable.ic_person_add)
    OnboardingHeading(stringResource(R.string.onboarding_guest_gate_title), stringResource(R.string.onboarding_guest_gate_description))
}

/** [GuestGoalGate]'s pinned bar, as main's: back to Today before the free account, the main action. */
@Composable
internal fun GuestGoalBar(
    onCreateAccount: () -> Unit,
    onBackToToday: () -> Unit,
) {
    TaskActions(back = {
        TextButton(onClick = onBackToToday, modifier = Modifier.taskOption()) { Text(stringResource(R.string.onboarding_back_to_today)) }
    }) { main ->
        Button(onClick = onCreateAccount, modifier = main) { Text(stringResource(R.string.onboarding_create_account)) }
    }
}
