const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. LATEX VALIDITY: The formula field must contain valid LaTeX syntax that renders correctly. Common issues: unmatched braces, invalid commands, missing backslashes.

2. FORMULA ACCURACY: The formula must match what the VISUAL_DESCRIPTION specifies. If the description names specific variables or notation, use those exactly — do not substitute different symbols.

3. DESCRIPTION QUALITY: The "description" field must be a brief plain-text explanation (max 100 chars) of what the formula represents. It must NOT be a copy of the VISUAL_DESCRIPTION input — it should be a concise label suitable for display.

4. FOCUS: One main equation, not a full derivation. For multi-line equations, use LaTeX aligned or cases environments.

5. LANGUAGE: The description field must be in the specified language. LaTeX notation is language-neutral.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-quadratic-formula",
    userInput: {
      description:
        "The quadratic formula: x equals negative b plus or minus the square root of b squared minus 4ac, all divided by 2a. Variables are a, b, and c as coefficients.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-compound-interest",
    userInput: {
      description:
        "Compound interest formula: A = P(1 + r/n)^(nt), where A is the final amount, P is principal, r is annual interest rate, n is compounding frequency, and t is time in years.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The description field must be in Brazilian Portuguese.
    `,
    id: "pt-lei-newton",
    userInput: {
      description:
        "Segunda lei de Newton: F = ma, onde F é a força resultante, m é a massa do objeto, e a é a aceleração. A força é medida em newtons (N).",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The description field must be in Latin American Spanish.
    `,
    id: "es-ley-gases-ideales",
    userInput: {
      description:
        "Ley de los gases ideales: PV = nRT, donde P es la presión, V el volumen, n la cantidad de sustancia en moles, R la constante universal de los gases, y T la temperatura absoluta en kelvin.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-bayes-theorem",
    userInput: {
      description:
        "Bayes' theorem: P(A|B) = P(B|A) * P(A) / P(B). The probability of A given B equals the probability of B given A times the prior probability of A, divided by the probability of B.",
      language: "en",
    },
  },
];
