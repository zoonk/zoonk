package com.zoonk.android.feature.player

import android.graphics.Bitmap
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.audio.RecordButton
import com.zoonk.android.feature.audio.VoiceRecorder
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Review screenshots of the subscription gate and the limits in a lesson, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*GateScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GateScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = PHONE)
    fun lessonFreeLaterToday() = capture("gate-lesson-free-today-phone") { access(free(Instant.now().plusSeconds(60))) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonFreeTomorrow() = capture("gate-lesson-free-tomorrow-phone") { access(free(Instant.now().plus(1, ChronoUnit.DAYS))) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonFreeOnADay() = capture("gate-lesson-free-on-day-phone") { access(free(Instant.now().plus(9, ChronoUnit.DAYS))) }

    @Test
    @Config(qualifiers = PHONE_DARK)
    fun lessonFreeOnADayDark() = capture("gate-lesson-free-on-day-phone-dark") { access(free(Instant.now().plus(9, ChronoUnit.DAYS))) }

    @Test
    @Config(qualifiers = TABLET)
    fun lessonFreeOnADayTablet() = capture("gate-lesson-free-on-day-tablet") { access(free(Instant.now().plus(9, ChronoUnit.DAYS))) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonFreeNoDay() = capture("gate-lesson-free-no-day-phone") { access(free(null)) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonGuest() = capture("gate-lesson-guest-phone") { access(Limit.Reached(LimitTier.Guest, LimitPeriod.Total)) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonSubscriberDay() = capture("gate-lesson-subscriber-day-phone") { access(Limit.Reached(LimitTier.Plus, LimitPeriod.Day)) }

    @Test
    @Config(qualifiers = PHONE)
    fun lessonGone() = capture("gate-lesson-gone-phone") { access(LessonRefusal.NotFound) }

    @Test
    @Config(qualifiers = PHONE, fontScale = 2f)
    fun inPlace() =
        capture("gate-in-place-phone-font200") {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                listOf(
                    free(Instant.now().plus(9, ChronoUnit.DAYS)) to LimitSubject.Lessons,
                    Limit.Reached(LimitTier.Free, LimitPeriod.Day) to LimitSubject.Explanations,
                    Limit.Reached(LimitTier.Guest, LimitPeriod.Day) to LimitSubject.Messages,
                    Limit.Reached(LimitTier.Plus, LimitPeriod.Month) to LimitSubject.Help,
                    Limit.SignUpRequired to LimitSubject.Help,
                ).forEach { (limit, subject) ->
                    LimitNotice(limit, subject, onCreateAccount = {}, onSubscribe = {})
                    HorizontalDivider()
                }
                RecordButton(VoiceRecorder.Status.Idle, onStart = {}, onStop = {})
                RecordButton(VoiceRecorder.Status.Recording(SystemClock.elapsedRealtime() - 7_000), onStart = {}, onStop = {})
            }
        }

    private fun free(availableAt: Instant?) = Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, availableAt)

    @Composable
    private fun access(limit: Limit) = access(LessonRefusal.Limited(limit))

    @Composable
    private fun access(refusal: LessonRefusal) =
        LessonFrame(title = "Multiplying powers of ten", onClose = {}, bottomBar = lessonAccessBar(refusal, onRetry = {}, exits = EXITS)) {
            LessonAccessScreen(refusal, onRetry = {})
        }

    private fun capture(
        name: String,
        content: @Composable () -> Unit,
    ) {
        compose.setContent { ZoonkTheme { Surface(Modifier.fillMaxSize()) { content() } } }
        compose.waitForIdle()
        val bitmap: Bitmap = compose.onRoot().captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}

private val EXITS =
    object : LessonPlayerExits {
        override fun close() = Unit

        override fun open(route: AppRoute) = Unit

        override fun replace(route: AppRoute) = Unit
    }

private const val PHONE = "w411dp-h891dp-xxhdpi"
private const val PHONE_DARK = "w411dp-h891dp-night-xxhdpi"
private const val TABLET = "w1280dp-h800dp-land-xhdpi"
