package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.reminders.StudyReminderStore
import com.zoonk.android.feature.reminders.openNotificationSettings
import com.zoonk.android.feature.reminders.rememberCanShowReminders
import com.zoonk.android.feature.reminders.rememberReminderPermission
import com.zoonk.android.feature.reminders.reminderTime
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.components.TimeOfDayDialog
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.StudyReminder
import kotlinx.coroutines.launch
import java.time.DateTimeException
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.TextStyle

/** A switch shows what it was flipped to while the change saves, and turns back if it doesn't. */
class RemindersViewModel(
    private val reminders: StudyReminderStore,
    private val snackbars: AppSnackbars,
) : ViewModel() {
    var email by mutableStateOf<Boolean?>(null)
        private set

    var push by mutableStateOf<Boolean?>(null)
        private set

    var movingPhone by mutableStateOf(false)
        private set

    /** Android refused notifications when this page asked. */
    var blocked by mutableStateOf(false)
        private set

    fun setTime(time: LocalTime) = save({}) { reminders.update(time = time.toString()) }

    fun setEmail(on: Boolean) {
        email = on
        save({ email = null }) { reminders.update(emailOn = on) }
    }

    private var askedBy: AuthenticatedSession? = null

    /** The learner tapped to turn push on or use this phone: what follows writes for them only. */
    fun asked() {
        askedBy = reminders.learner
    }

    fun turnOnPush() {
        blocked = false
        push = true
        save({ push = null }) { reminders.turnOnPush(learner = askedBy) }
    }

    fun turnOffPush() {
        push = false
        save({ push = null }) { reminders.update(pushOn = false) }
    }

    fun useThisPhone() {
        blocked = false
        movingPhone = true
        save({ movingPhone = false }) { reminders.useThisPhone(askedBy) }
    }

    fun blocked() {
        blocked = true
    }

    private fun save(
        settle: () -> Unit,
        write: suspend () -> MutationResult<*>,
    ) {
        viewModelScope.launch {
            if (write() is MutationResult.Failed) snackbars.show(R.string.reminders_save_failed)
            settle()
        }
    }
}

/**
 * Main's Settings > Reminders: the time in the learner's zone, email, push to one phone, then where
 * the study days come from. Android's notification permission and the reminders channel are read
 * live, so a phone that can't show them says so.
 */
@Composable
fun RemindersScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val state by app.reminders.reminder.collectShown()
    val viewModel = viewModel { RemindersViewModel(app.reminders, app.snackbars) }
    val scope = rememberCoroutineScope()

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.reminders_title)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageHeader(
                    stringResource(R.string.reminders_title),
                    stringResource(R.string.reminders_description),
                    Modifier.padding(horizontal = LIST_ITEM_INSET),
                )

                when (val shown = state) {
                    is LoadState.Loaded -> {
                        ReminderSettings(shown.value, app.reminders.isThisPhone(shown.value), viewModel, navigator)
                    }

                    is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { scope.launch { app.reminders.reminder.refresh() } })
                    }

                    LoadState.Loading -> {
                        CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                    }

                    LoadState.Idle, LoadState.Empty -> {}
                }
            }
        }
    }
}

@Composable
private fun ReminderSettings(
    reminder: StudyReminder,
    thisPhone: Boolean,
    viewModel: RemindersViewModel,
    navigator: AppNavigator,
) {
    var picking by rememberSaveable { mutableStateOf(false) }
    val time = reminderTime(reminder.time)

    Column {
        ListRow(
            headline = { Text(stringResource(R.string.reminders_time)) },
            supporting = { Text(stringResource(R.string.reminders_time_in_zone, time, zoneName(reminder.timeZone))) },
            onClick = { picking = true },
        )
        ListDivider()
        EmailRow(reminder, viewModel, navigator)
        ListDivider()
        PushRows(reminder, thisPhone, viewModel)
    }

    ListRow(
        headline = {
            Text(
                stringResource(R.string.reminders_study_days),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        },
        onClick = { navigator.open(AppRoute.Plan()) },
    )

    if (reminder.quiet) {
        Text(
            stringResource(R.string.reminders_quiet),
            Modifier.padding(horizontal = LIST_ITEM_INSET),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    if (picking) {
        TimeOfDayDialog(
            initial = LocalTime.parse(reminder.time),
            title = stringResource(R.string.reminders_time_title),
            confirmLabel = stringResource(R.string.reminders_save),
            dismissLabel = stringResource(R.string.reminders_cancel),
            onPick = viewModel::setTime,
            onDismiss = { picking = false },
        )
    }
}

/** A guest has no address to email yet. */
@Composable
private fun EmailRow(
    reminder: StudyReminder,
    viewModel: RemindersViewModel,
    navigator: AppNavigator,
) {
    val address = reminder.email.address
    if (address == null) {
        ListRow(
            headline = { Text(stringResource(R.string.reminders_email)) },
            supporting = { Text(stringResource(R.string.reminders_email_needs_account)) },
            onClick = { navigator.open(AppRoute.Login) },
        )
        return
    }

    SwitchRow(
        title = stringResource(R.string.reminders_email),
        description = address,
        checked = viewModel.email ?: reminder.email.on,
        onCheckedChange = viewModel::setEmail,
    )
}

/** The switch names the phone push goes to; another phone can take over, and a blocked one says so. */
@Composable
private fun PushRows(
    reminder: StudyReminder,
    thisPhone: Boolean,
    viewModel: RemindersViewModel,
) {
    val context = LocalContext.current
    val canShow = rememberCanShowReminders()
    val turnOn = rememberReminderPermission { allowed -> if (allowed) viewModel.turnOnPush() else viewModel.blocked() }
    val move = rememberReminderPermission { allowed -> if (allowed) viewModel.useThisPhone() else viewModel.blocked() }
    val phone = reminder.push.phone
    val on = viewModel.push ?: reminder.push.on

    SwitchRow(
        title = stringResource(R.string.reminders_push),
        description = phone?.label,
        checked = on,
        onCheckedChange = {
            if (it) {
                viewModel.asked()
                turnOn()
            } else {
                viewModel.turnOffPush()
            }
        },
    )

    if (phone != null && !thisPhone) {
        ListRow(
            headline = { Text(stringResource(R.string.reminders_use_this_phone)) },
            onClick = {
                viewModel.asked()
                move()
            },
            busy = viewModel.movingPhone,
            chevron = false,
        )
    }

    if (!canShow && (viewModel.blocked || (on && thisPhone))) {
        ListRow(
            headline = {
                Text(
                    stringResource(R.string.reminders_notifications_off),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            },
            leading = { Icon(painterResource(R.drawable.ic_notifications_off), contentDescription = null) },
            trailing = {
                OutlinedButton(onClick = context::openNotificationSettings, size = ButtonSize.Small) {
                    Text(stringResource(R.string.reminders_open_settings))
                }
            },
        )
    }
}

@Composable
private fun zoneName(timeZone: String): String {
    val locale = currentLocale()
    return try {
        ZoneId.of(timeZone).getDisplayName(TextStyle.FULL, locale)
    } catch (e: DateTimeException) {
        timeZone
    }
}
