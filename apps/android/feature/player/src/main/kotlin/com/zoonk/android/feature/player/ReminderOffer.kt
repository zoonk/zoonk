package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onVisibilityChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionState
import com.zoonk.android.feature.reminders.StudyReminderStore
import com.zoonk.android.feature.reminders.nearestQuarterHour
import com.zoonk.android.feature.reminders.openNotificationSettings
import com.zoonk.android.feature.reminders.rememberCanShowReminders
import com.zoonk.android.feature.reminders.rememberReminderPermission
import com.zoonk.android.feature.reminders.reminderTime
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.TimeOfDayDialog
import com.zoonk.api.models.StudyReminderOffer
import kotlinx.coroutines.launch
import java.time.LocalTime

enum class OfferStep { Claiming, Asking, Blocked, PushOn, EmailOn, Gone }

/** The study reminder offered once, under a finished plan lesson's result. */
class ReminderOfferViewModel(
    private val reminders: StudyReminderStore,
    time: String,
) : ViewModel() {
    var time by mutableStateOf(LocalTime.parse(time).nearestQuarterHour().toString())
        private set

    var step by mutableStateOf(OfferStep.Claiming)
        private set

    var saving by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    private var claimed = false

    /**
     * Seeing it ends asking, wherever it was seen first. Its choices show only once this showing
     * claimed it, so a "No thanks" can't be lost to a claim that didn't save.
     */
    fun seen() {
        if (claimed) return
        claimed = true
        viewModelScope.launch {
            val claim = reminders.claimOffer()
            step = if ((claim as? MutationResult.Done)?.value == true) OfferStep.Asking else OfferStep.Gone
        }
    }

    fun pick(time: LocalTime) {
        this.time = time.nearestQuarterHour().toString()
    }

    fun decline() {
        step = OfferStep.Gone
    }

    /** Android won't show notifications. */
    fun blocked() {
        step = OfferStep.Blocked
    }

    private var askedBy: AuthenticatedSession? = null

    /** "Remind me" was tapped: what follows writes for this learner only. */
    fun asked() {
        askedBy = reminders.learner
    }

    fun turnOnPush() {
        step = OfferStep.Asking
        save(OfferStep.PushOn) { reminders.turnOnPush(time, askedBy) }
    }

    fun email() = save(OfferStep.EmailOn) { reminders.update(time = time, emailOn = true) }

    private fun save(
        done: OfferStep,
        write: suspend () -> MutationResult<*>,
    ) {
        if (saving) return
        saving = true
        failed = false
        viewModelScope.launch {
            when (write()) {
                is MutationResult.Done -> {
                    step = done
                }

                is MutationResult.Failed -> {
                    failed = true
                }

                MutationResult.Obsolete -> {}
            }
            saving = false
        }
    }
}

/**
 * Below the result, never in place of what comes next. "Remind me" asks Android for notifications
 * only then; while Android refuses, the learner can open its settings or, with an account, get
 * email instead.
 */
@Composable
fun ReminderOfferCard(
    app: AppContainer,
    offer: StudyReminderOffer,
) {
    val viewModel = viewModel(key = "reminder-offer") { ReminderOfferViewModel(app.reminders, offer.time) }
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val hasAccount = (session as? SessionState.SignedIn)?.isGuest == false
    val canShow = rememberCanShowReminders()
    val ask = rememberReminderPermission { allowed -> if (allowed) viewModel.turnOnPush() else viewModel.blocked() }
    var picking by rememberSaveable { mutableStateOf(false) }
    val time = reminderTime(viewModel.time)

    // Back from Android's settings with notifications on: the learner already said "Remind me".
    LaunchedEffect(canShow, viewModel.step) { if (canShow && viewModel.step == OfferStep.Blocked) viewModel.turnOnPush() }

    if (viewModel.step == OfferStep.Gone) return

    // A learner who never scrolls to it keeps the offer for their next lesson.
    OutlinedCard(Modifier.fillMaxWidth().onVisibilityChanged(minFractionVisible = 0.5f) { if (it) viewModel.seen() }) {
        Column(Modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (viewModel.step) {
                OfferStep.Claiming -> {
                    OfferWords(time)
                }

                OfferStep.Asking -> {
                    OfferWords(time)
                    ListRow(
                        headline = { Text(stringResource(R.string.reminders_time_title)) },
                        leading = { Icon(painterResource(R.drawable.ic_schedule), contentDescription = null) },
                        meta = { Text(time) },
                        onClick = { picking = true },
                        enabled = !viewModel.saving,
                    )
                    Failure(viewModel.failed)
                    OfferActions {
                        Button(
                            onClick = {
                                viewModel.asked()
                                ask()
                            },
                            busy = viewModel.saving,
                        ) { Text(stringResource(R.string.reminders_remind_me)) }
                        TextButton(onClick = viewModel::decline, enabled = !viewModel.saving) {
                            Text(stringResource(R.string.reminders_no_thanks))
                        }
                    }
                }

                OfferStep.Blocked -> {
                    val context = LocalContext.current
                    OfferNote(R.drawable.ic_notifications_off, stringResource(R.string.reminders_notifications_off))
                    Failure(viewModel.failed)
                    OfferActions {
                        OutlinedButton(
                            onClick = context::openNotificationSettings,
                        ) { Text(stringResource(R.string.reminders_open_settings)) }
                        if (hasAccount) {
                            TextButton(onClick = viewModel::email, busy = viewModel.saving) {
                                Text(stringResource(R.string.reminders_email_instead))
                            }
                        }
                    }
                }

                OfferStep.PushOn -> {
                    OfferNote(R.drawable.ic_check_circle, stringResource(R.string.reminders_on))
                }

                OfferStep.EmailOn -> {
                    OfferNote(R.drawable.ic_check_circle, stringResource(R.string.reminders_email_on))
                }

                OfferStep.Gone -> {}
            }
        }
    }

    if (picking) {
        TimeOfDayDialog(
            initial = LocalTime.parse(viewModel.time),
            title = stringResource(R.string.reminders_time_title),
            confirmLabel = stringResource(R.string.reminders_save),
            dismissLabel = stringResource(R.string.reminders_cancel),
            onPick = viewModel::pick,
            onDismiss = { picking = false },
        )
    }
}

@Composable
private fun OfferWords(time: String) {
    Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.reminders_offer_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            stringResource(R.string.reminders_offer_body, time),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun OfferNote(
    icon: Int,
    text: String,
) {
    Row(
        Modifier
            .padding(horizontal = LIST_ITEM_INSET)
            .semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(20.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun Failure(failed: Boolean) {
    if (!failed) return
    Text(
        stringResource(R.string.reminders_turn_on_failed),
        Modifier
            .padding(horizontal = LIST_ITEM_INSET)
            .semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun OfferActions(content: @Composable () -> Unit) {
    FlowRow(
        Modifier.padding(horizontal = LIST_ITEM_INSET),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}
