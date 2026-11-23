package com.zoonk.android.feature.goalcontent

import androidx.activity.ComponentActivity
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusTopic
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlanReasonTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aKnownPhaseSaysItWasSkippedAsKnown() = reason("known", "Skipped · you already know it")

    @Test
    fun aPastBasicsSubjectDoesNotClaimThereIsTooLittleTime() = reason("pastBasics", "Skipped · you already know the basics")

    @Test
    fun aSkippedBaseNamesTheLearnersChoice() = reason("skippedBase", "Skipped · your choice")

    @Test
    fun anUnknownFutureReasonStillReadsAsOutsideThePlan() {
        val original = examSyllabus()
        val encoded = ApiJson.encodeToJsonElement(Syllabus.serializer(), original).jsonObject
        val subject =
            encoded.getValue("subjects").jsonArray.first().jsonObject.toMutableMap().apply {
                set("notPlannedReason", JsonPrimitive("futureReason"))
                set("bar", kotlinx.serialization.json.JsonNull)
            }
        val wire = JsonObject(encoded + ("subjects" to JsonArray(listOf(JsonObject(subject)))))
        val decoded = ApiJson.decodeFromJsonElement(Syllabus.serializer(), wire)
        compose.setContent { ZoonkTheme { PlanSyllabusSection(decoded, {}) } }
        compose.onNodeWithText("Not in your plan").assertExists()
        compose.onNodeWithText("Not in your plan · other topics come first").assertDoesNotExist()
    }

    @Test
    fun topicRowsUseTheSameReasonAsThePath() {
        val original = examSyllabus()
        val subject = original.subjects.first { it.topics.isNotEmpty() }
        val reason = mutableStateOf("pastBasics")
        compose.setContent {
            ZoonkTheme {
                LazyColumn {
                    subjectTopics(
                        original,
                        subject.copy(
                            topics =
                                listOf(
                                    subject.topics.first().copy(
                                        status = SyllabusTopic.Status.NOT_PLANNED,
                                        notPlannedReason = reason.value,
                                        chapters = emptyList(),
                                    ),
                                ),
                        ),
                        SubjectActions({}, {}, {}, {}, {}),
                    )
                }
            }
        }
        for ((value, label) in listOf(
            "pastBasics" to "Skipped · you already know the basics",
            "skippedBase" to "Skipped · your choice",
            "known" to "Skipped · you already know it",
            "skipped" to "Not in your plan · you took this subject out",
            "time" to "Not in your plan · other topics come first",
            "missing" to "Not ready yet",
        )) {
            compose.runOnIdle { reason.value = value }
            compose.onNodeWithText(label).assertExists()
        }
    }

    private fun reason(
        reason: String,
        label: String,
    ) {
        val original = examSyllabus()
        val syllabus = original.copy(subjects = listOf(original.subjects.first().copy(notPlannedReason = reason)))
        compose.setContent { ZoonkTheme { PlanSyllabusSection(syllabus, {}) } }
        compose.onNodeWithText(label).assertExists()
        compose.onNodeWithText("Not in your plan · other topics come first").assertDoesNotExist()
    }
}
