package com.zoonk.android.feature.player.steps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TeachingMarksTest {
    private val text = "Da renda bruta saem R$ 330,00.\n\nSobram R$ 2.870,00.\n\nEsse valor se chama **renda líquida**, o que cai na conta."

    @Test
    fun splitsTheRawTextAroundItsExampleSentences() {
        val split = splitExample(text, "Sobram R$ 2.870,00.")

        assertEquals(ExampleSplit("Da renda bruta saem R$ 330,00.", "Sobram R$ 2.870,00.", text.substringAfter("2.870,00.").trim()), split)
        assertNull(splitExample(text, "Sobram R$ 2.900,00."))
    }

    @Test
    fun findsAnUnderlineThatRunsThroughABoldTermInTheShownWords() {
        val split = checkNotNull(splitExample(text, "Sobram R$ 2.870,00."))

        assertEquals(2, underlinedPart(split.parts, "se chama renda líquida, o que"))
        assertNull(underlinedPart(split.parts, "renda líquida cai"))
    }

    @Test
    fun keepsANumberedListWholeRatherThanFramingAnExampleInsideIt() {
        val steps = "Para somar frações:\n\n1. Ache o denominador comum.\n2. Some 1/4 + 2/4 = 3/4.\n3. Simplifique."

        assertNull(splitExample(steps, "Some 1/4 + 2/4 = 3/4."))
        assertNull(splitExample(steps, "2. Some 1/4 + 2/4 = 3/4."))
        assertEquals(
            "Para somar frações:",
            splitExample("Para somar frações:\n\n- Ache o denominador comum.", "Para somar frações:")?.example,
        )
    }

    @Test
    fun underlinesOnePartWhenTheTextAroundTheExampleRepeats() {
        val split =
            checkNotNull(
                splitExample("Cells use energy.\n\nA cat gets energy from food.\n\nCells use energy.", "A cat gets energy from food."),
            )

        assertEquals(0, underlinedPart(split.parts, "Cells use energy."))
    }
}
