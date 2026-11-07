package com.zoonk.android.feature.reminders

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.text.format.DateFormat
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.zoonk.android.R
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatTimeOfDay
import java.time.LocalTime

/** Whether this phone can show reminders: Zoonk's notifications are allowed and their channel isn't turned off. */
fun Context.canShowReminders(): Boolean {
    val manager = NotificationManagerCompat.from(this)
    val channel = manager.getNotificationChannelCompat(FirebasePush.CHANNEL)
    return manager.areNotificationsEnabled() && channel?.importance != NotificationManagerCompat.IMPORTANCE_NONE
}

/** [canShowReminders], read again whenever the screen resumes, as after the learner was in Android's settings. */
@Composable
fun rememberCanShowReminders(): Boolean {
    val context = LocalContext.current
    var allowed by remember { mutableStateOf(context.canShowReminders()) }
    LifecycleResumeEffect(context) {
        allowed = context.canShowReminders()
        onPauseOrDispose {}
    }
    return allowed
}

fun Context.openNotificationSettings() {
    startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
}

/**
 * Asks Android to allow notifications, with Zoonk's reason first when Android says to give one.
 * [onResult] hears whether reminders can show; once Android stops asking, only its settings change that.
 */
@Composable
fun rememberReminderPermission(onResult: (Boolean) -> Unit): () -> Unit {
    val context = LocalContext.current
    val activity = LocalActivity.current
    val result by rememberUpdatedState(onResult)
    var explaining by rememberSaveable { mutableStateOf(false) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { result(context.canShowReminders()) }

    if (explaining && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        AlertDialog(
            onDismissRequest = { explaining = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        explaining = false
                        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    },
                ) { Text(stringResource(R.string.reminders_permission_continue)) }
            },
            dismissButton = { TextButton(onClick = { explaining = false }) { Text(stringResource(R.string.reminders_not_now)) } },
            title = { Text(stringResource(R.string.reminders_permission_title)) },
            text = { Text(stringResource(R.string.reminders_permission_body)) },
        )
    }

    return {
        when {
            context.canShowReminders() -> {
                result(true)
            }

            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU -> {
                result(false)
            }

            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED -> {
                result(false)
            }

            activity?.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) == true -> {
                explaining = true
            }

            else -> {
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}

/** A reminder's `HH:mm` time as the device shows times of day. */
@Composable
fun reminderTime(time: String): String =
    formatTimeOfDay(LocalTime.parse(time), currentLocale(), DateFormat.is24HourFormat(LocalContext.current))
