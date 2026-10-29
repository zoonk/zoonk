package com.zoonk.android.feature.livecall

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.zoonk.android.MainActivity
import com.zoonk.android.R
import com.zoonk.android.app.ZoonkApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class OngoingCall(
    val name: String,
    val startedAt: Long,
    val hangUp: () -> Unit,
    val leave: () -> Unit,
)

/**
 * The call the microphone service keeps going while the app is in the background, with Hang up in
 * its notification. The service stays until the server confirmed the hangup, so the app isn't let
 * go while the call is still billed.
 */
class OngoingCalls(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private val mutableCurrent = MutableStateFlow<OngoingCall?>(null)
    val current: StateFlow<OngoingCall?> = mutableCurrent.asStateFlow()

    /** Call it right after [LiveCall.start], from the learner's tap: Android starts a microphone service only while the app is in use. */
    fun keep(
        call: LiveCall,
        characterName: String,
    ) {
        val ongoing = OngoingCall(characterName, System.currentTimeMillis(), call::hangUp, call::leave)
        mutableCurrent.value = ongoing
        // Without the microphone there's nothing a microphone service may keep: the call runs while it's on screen.
        val microphone = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (microphone) ContextCompat.startForegroundService(context, Intent(context, LiveCallService::class.java))
        scope.launch {
            call.state.first { !it.isOpen }
            call.release()
            if (mutableCurrent.value === ongoing) {
                mutableCurrent.value = null
                context.stopService(Intent(context, LiveCallService::class.java))
            }
        }
    }
}

/** Ends the call when Android tears it down: a call left open is billed until the server's deadline. */
class LiveCallService : Service() {
    private val calls get() = (application as ZoonkApplication).container.calls

    override fun onBind(intent: Intent?) = null

    // ServiceCompat passes the service type only to the versions that take it.
    @SuppressLint("InlinedApi")
    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        val call = calls.current.value
        if (intent?.action == ACTION_HANG_UP) {
            call?.hangUp()
            return START_NOT_STICKY
        }
        // Android expects the notification even when the call already ended.
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(call), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        if (call == null) stopSelf()
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        calls.current.value?.leave()
    }

    override fun onDestroy() {
        calls.current.value?.leave()
        super.onDestroy()
    }

    private fun notification(call: OngoingCall?): android.app.Notification {
        val channel =
            NotificationChannelCompat
                .Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_LOW)
                .setName(getString(R.string.livecall_channel))
                .build()
        NotificationManagerCompat.from(this).createNotificationChannel(channel)

        val open =
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
                PendingIntent.FLAG_IMMUTABLE,
            )
        val hangUp =
            PendingIntent.getService(
                this,
                0,
                Intent(this, LiveCallService::class.java).setAction(ACTION_HANG_UP),
                PendingIntent.FLAG_IMMUTABLE,
            )
        val person =
            Person
                .Builder()
                .setName(call?.name ?: getString(R.string.livecall_channel))
                .setImportant(true)
                .build()
        return NotificationCompat
            .Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_call)
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
            .setContentIntent(open)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setWhen(call?.startedAt ?: System.currentTimeMillis())
            .setUsesChronometer(true)
            .build()
    }

    private companion object {
        const val CHANNEL = "calls"
        const val NOTIFICATION_ID = 1
        const val ACTION_HANG_UP = "com.zoonk.android.livecall.HANG_UP"
    }
}
