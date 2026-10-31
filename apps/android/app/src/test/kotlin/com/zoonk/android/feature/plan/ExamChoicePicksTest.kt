package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExamChoice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExamChoicePicksTest {
    private fun modules(
        subjects: List<String> = emptyList(),
        take: Int = 2,
    ): ExamChoice =
        ApiJson.decodeFromString(
            """
            {"group":"Módulos","leftOut":{"examPoints":null,"examQuestions":null,"name":"Módulos","points":null,"questions":48},
             "options":[{"name":"Biología","shortName":null},{"name":"Ciencias Sociales y Humanidades","shortName":"Sociales"},
              {"name":"Química","shortName":null}],
             "subjects":[${subjects.joinToString(",") { "\"$it\"" }}],"take":$take}
            """.trimIndent(),
        )

    @Test
    fun aTickKeepsTheNoticesOrderAndAnUntickDropsIt() {
        val choice = modules()

        val picked = choice.toggled(choice.toggled(emptyList(), "Química"), "Biología")

        assertEquals(listOf("Biología", "Química"), picked)
        assertEquals(listOf("Química"), choice.toggled(picked, "Biología"))
    }

    @Test
    fun nothingMoreTicksOnceTheChoiceTakesAllItCan() {
        val choice = modules()
        val picked = listOf("Biología", "Química")

        assertTrue(choice.isFull(picked))
        assertEquals(picked, choice.toggled(picked, "Ciencias Sociales y Humanidades"))
        assertFalse(choice.isFull(listOf("Biología")))
    }

    @Test
    fun aDraftSavesOnlyWithAnOptionAndWhenItDiffersFromThePlansPick() {
        val choice = modules(subjects = listOf("Biología", "Química"))

        assertFalse(choice.canSave(emptyList()))
        assertFalse(choice.canSave(listOf("Química", "Biología")))
        assertTrue(choice.canSave(listOf("Biología")))
        assertTrue(modules().canSave(listOf("Química")))
    }

    @Test
    fun thePicksAreNamedAsThePlanNamesThemInTheNoticesOrder() {
        val choice = modules(subjects = listOf("Química", "Ciencias Sociales y Humanidades"))

        assertEquals(listOf("Sociales", "Química"), choice.pickedNames())
        assertEquals(emptyList<String>(), modules().pickedNames())
    }
}
