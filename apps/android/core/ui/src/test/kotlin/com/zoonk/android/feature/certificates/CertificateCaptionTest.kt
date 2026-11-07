package com.zoonk.android.feature.certificates

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.CertificateImageUrls
import com.zoonk.api.models.OwnedCertificate
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.net.URI

@RunWith(AndroidJUnit4::class)
class CertificateCaptionTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun captions(vararg minutes: Long?): List<String> {
        var captions = emptyList<String>()
        rule.setContent { captions = minutes.map { course(it).caption() } }
        rule.waitForIdle()
        return captions
    }

    @Test
    fun studyTimeReadsAsMainSaysIt() {
        val lessons = "I just finished Python on Zoonk: 12 lessons"

        assertEquals(
            listOf(
                "$lessons.",
                "$lessons.",
                "$lessons and about 1 minute of study.",
                "$lessons and about 45 minutes of study.",
                "$lessons and about 59 minutes of study.",
                "$lessons and about 1 hour of study.",
                "$lessons and about 1 hour of study.",
                "$lessons and about 2 hours of study.",
            ),
            captions(null, 0, 1, 45, 59, 60, 89, 90),
        )
    }

    @Test
    @Config(qualifiers = "pl")
    fun minutesTakeTheirLanguagesPluralForm() {
        val lessons = "Kurs „Python” w Zoonku już za mną: 12 lekcji i mniej więcej"

        assertEquals(
            listOf("$lessons 22 minuty nauki.", "$lessons 25 minut nauki."),
            captions(22, 25),
        )
    }
}

private fun course(minutes: Long?): OwnedCertificate {
    val picture = "https://www.zoonk.com/en/c/K7QF2M9XHD4P/image"
    return OwnedCertificate(
        category = null,
        cefrRange = null,
        code = "K7QF2M9XHD4P",
        completedOn = LocalDate(2026, 11, 3),
        courseId = null,
        courseLevel = null,
        language = "en",
        lessonsStudied = 12,
        lessonsTestedOut = 0,
        minutes = minutes,
        recipientName = "Ana Souza",
        title = "Python",
        topics = emptyList(),
        locked = false,
        shownAt = null,
        imageUrls =
            CertificateImageUrls(
                link = URI("$picture/link.png"),
                post = URI("$picture/post.png"),
                print = URI("$picture/print.png"),
                screen = URI("$picture/screen.png"),
            ),
        linkedInUrl = URI("https://www.linkedin.com/profile/add"),
        url = URI("https://www.zoonk.com/c/K7QF2M9XHD4P"),
    )
}
