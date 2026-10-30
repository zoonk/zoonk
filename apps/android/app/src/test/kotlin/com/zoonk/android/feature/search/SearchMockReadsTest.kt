package com.zoonk.android.feature.search

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.exam.ExamStore
import com.zoonk.android.feature.exam.LiveExamApi
import com.zoonk.android.feature.exam.exam
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExamMockSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SearchMockReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val api = CountingApi(mapOf(EXAM to ApiJson.encodeToString(exam(FINISHED_MOCK))))

    @After
    fun stop() = api.close()

    @Test
    fun theExamPageAndSearchReadAGoalsExamOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), scope)
        val exams = ExamStore(LiveExamApi(api.clients), cache) { "UTC" }
        var searching by mutableStateOf(false)
        var found = emptyList<ExamMockSummary>()

        rule.setContent {
            ZoonkTheme {
                Column {
                    exams.exam[GOAL].collectShown()
                    if (searching) found = searchedMocks(exams, GOAL)
                }
            }
        }
        rule.waitFor { exams.exam[GOAL].state.value is LoadState.Loaded }
        rule.runOnIdle { searching = true }
        rule.waitFor { found.isNotEmpty() }

        assertEquals(1, api.requests(EXAM))
    }

    private companion object {
        val GOAL: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
        val EXAM = "/goals/$GOAL/exam"
        const val FINISHED_MOCK =
            """"mocks":[{"blockId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03","correct":41,"examQuestions":null,"finishedAt":"2026-10-20T15:00:00Z",
            "measure":41,"number":1,"purpose":"practice","scoring":"raw","shape":{"area":null,"day":1,"kind":"full"},"total":90}]"""
    }
}
