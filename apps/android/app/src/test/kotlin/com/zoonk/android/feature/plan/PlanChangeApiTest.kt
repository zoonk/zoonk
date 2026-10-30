package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit

class PlanChangeApiTest {
    private val server = MockWebServer()
    private lateinit var api: LivePlanApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString("c0bddf58-9c71-8b20-836b-152dbc39a61a")

    @Before
    fun start() {
        server.start()
        api = LivePlanApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() = server.close()

    @Test
    fun noDateIsSentAsAnExplicitNull() =
        runTest {
            server.enqueue(MockResponse.Builder().code(500).build())

            runCatching { api.change(ana, goalId, listOf(PlanOp.TargetDate(null))) }

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("/v1/goals/$goalId/plan/changes", request.url.encodedPath)
            assertEquals(
                Json.parseToJsonElement(
                    """{"operations":[{"kind":"setTargetDate","targetDate":null}],"timeZone":"${ZoneId.systemDefault().id}"}""",
                ),
                Json.parseToJsonElement(request.body!!.utf8()),
            )
        }
}
