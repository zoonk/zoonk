package com.zoonk.android.feature.player.steps

import org.junit.Assert.assertEquals
import org.junit.Test

// The cases of main's `lesson-aside.test.ts` for `splitQuestionData`.
class QuestionDataTest {
    private val code = "```python\nfor i in range(3):\n    print(i)\n```"

    @Test
    fun `shows a question's code above it, with the question as its title`() {
        assertEquals(code to "What does this print?", splitQuestionData("What does this print?\n$code"))
        assertEquals(
            "Look at this:\n\n$code" to "What does it print?",
            splitQuestionData("Look at this:\n\n$code\n\nWhat does it print?"),
        )
    }

    @Test
    fun `keeps a question with no table or code whole`() {
        assertEquals(null to "What is `x`?", splitQuestionData("What is `x`?"))
    }
}
