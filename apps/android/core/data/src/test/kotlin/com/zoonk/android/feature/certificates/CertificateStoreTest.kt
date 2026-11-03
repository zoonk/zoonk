package com.zoonk.android.feature.certificates

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.CertificateImageUrls
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test
import java.net.URI
import java.util.UUID

class CertificateStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Test
    fun aCompletionReadsTheListAgainOnlyWhenItLacksWhatWasEarned() =
        runTest {
            val api = FakeCertificatesApi(listOf(owned("K7QF2M9XHD4P")))
            val store = store(api)

            store.certificates.load()
            store.awarded(listOf("K7QF2M9XHD4P"))
            store.certificates.load()
            assertEquals(1, api.reads)

            api.held = listOf(owned("A1B2C3D4E5F6"), owned("K7QF2M9XHD4P"))
            store.awarded(listOf("A1B2C3D4E5F6"))
            store.certificates.load()
            assertEquals(2, api.reads)
        }

    private fun TestScope.store(api: CertificatesApi): CertificateStore {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return CertificateStore(api, AppCache(FakeSession(ana), scope))
    }
}

private class FakeCertificatesApi(
    var held: List<OwnedCertificate>,
) : CertificatesApi {
    var reads = 0

    override suspend fun list(session: AuthenticatedSession): List<OwnedCertificate> {
        reads++
        return held
    }

    override suspend fun markShown(
        session: AuthenticatedSession,
        code: String,
    ) = Unit

    override suspend fun claim(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = held.first()
}

private fun owned(code: String): OwnedCertificate {
    val page = "https://www.zoonk.com/c/$code"
    val picture = "https://www.zoonk.com/en/c/$code/image"
    return OwnedCertificate(
        answered = null,
        canDo = emptyList(),
        category = null,
        code = code,
        completedOn = LocalDate(2026, 11, 3),
        courseId = null,
        courseLevels = emptyList(),
        kind = OwnedCertificate.Kind.COURSE,
        language = "en",
        lessonsStudied = 12,
        lessonsTestedOut = 0,
        level = null,
        measuredLevel = null,
        minutes = 240,
        recipientName = "Ana Souza",
        skillLevels = emptyList(),
        targetLanguage = null,
        title = "Python",
        topics = emptyList(),
        shownAt = null,
        imageUrls =
            CertificateImageUrls(
                link = URI("$picture/link.png"),
                post = URI("$picture/post.png"),
                print = URI("$picture/print.png"),
                screen = URI("$picture/screen.png"),
            ),
        linkedInUrl = URI("https://www.linkedin.com/profile/add"),
        url = URI(page),
    )
}
