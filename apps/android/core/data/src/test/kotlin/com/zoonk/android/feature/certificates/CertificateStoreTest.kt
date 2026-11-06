package com.zoonk.android.feature.certificates

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CertificateImageUrls
import com.zoonk.api.models.Goal
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

    @Test
    fun closingAMomentLeavesTheListAsItIs() =
        runTest {
            val api = FakeCertificatesApi(listOf(owned("K7QF2M9XHD4P")))
            val store = store(api)

            store.certificates.load()
            store.markShown("K7QF2M9XHD4P")
            store.certificates.load()

            assertEquals(1, api.reads)
        }

    @Test
    fun upNextKeepsActiveCoursesWithLessonsAndLanguagesAsMainDoes() {
        val upNext =
            certificateUpNext(
                listOf(
                    goal("Python", kind = "learn", lessons = 3 to 12),
                    goal("Spanish", kind = "language"),
                    goal("SAT", kind = "exam", lessons = 0 to 0),
                    goal("Guitar", kind = "learn", status = "paused", lessons = 1 to 4),
                    goal("Rust", kind = "learn", status = "completed", lessons = 4 to 4),
                    goal("Why is the sky blue?", kind = "explain"),
                ),
            )

        assertEquals(listOf("Python" to 0.25, "Spanish" to null), upNext.map { it.goal.title to it.progress })
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
    ) = held

    override suspend fun goals(session: AuthenticatedSession) = emptyList<Goal>()
}

private fun goal(
    title: String,
    kind: String,
    status: String = "active",
    lessons: Pair<Int, Int>? = null,
): Goal {
    val plan =
        lessons?.let { (done, total) ->
            """{"currentPhase":null,"endDate":null,"lessonsDone":$done,"lessonsTotal":$total,"phaseCount":1,"ready":true}"""
        }
    return ApiJson.decodeFromString(
        """
        {"createdAt":"2026-11-03T00:00:00.000Z","dailyMinutes":20,"details":{},"examBlueprintId":null,
         "id":"${UUID.randomUUID()}","isActive":false,"kind":"$kind","language":"en","plan":${plan ?: "null"},
         "primaryCourseId":null,"prompt":"$title","status":"$status","studyDays":[1,2,3],"studyTime":null,
         "targetDate":null,"targetLanguage":null,"timezone":null,"title":"$title"}
        """.trimIndent(),
    )
}

private fun owned(code: String): OwnedCertificate {
    val page = "https://www.zoonk.com/c/$code"
    val picture = "https://www.zoonk.com/en/c/$code/image"
    return OwnedCertificate(
        canDo = emptyList(),
        category = null,
        code = code,
        completedOn = LocalDate(2026, 11, 3),
        courseId = null,
        courseLevel = null,
        kind = OwnedCertificate.Kind.COURSE,
        language = "en",
        lessonsStudied = 12,
        lessonsTestedOut = 0,
        level = null,
        minutes = 240,
        recipientName = "Ana Souza",
        skillLevels = emptyList(),
        targetLanguage = null,
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
        url = URI(page),
    )
}
