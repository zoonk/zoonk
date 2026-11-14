import { describe, expect, it } from "vitest";
import { splitAtMath } from "./math-spans";

const CASES = [
  String.raw`Use \(x^2\) here`,
  String.raw`Display \[x^2 + 1\] here`,
  "The value $5$ is odd",
  "It costs $5 and the gap is $10^{-5}$ m",
  "Let $n$ be even",
  String.raw`Area is $$\frac{1}{2} x^2$$ here`,
  "Between $a$ and $b$, it costs $3",
  "Pay R$5 for $x^2$",
  "**the $10^{3}$ rule** here",
  "**$E = mc^2$**",
  "*about $x^2$ squared*",
  "Use **$v = d / t$** to find speed.",
  "It is **bold** and $x^2$ math",
  "**$20.12**",
  "It costs $5 or **about $10** now.",
  String.raw`V(x)=-V_0 pour \(|x|<a\) et V(x)=0 ailleurs, avec \(a>0\).`,
  String.raw`Pour \(0<p<1\), si \(p>0{,}5\) alors`,
  "If $x<b$ and $y>c$, then",
  "It costs $5 and $10, or R$ 80.",
  "A US$5 fee",
  String.raw`Pay \$5 now, then $x$`,
  String.raw`Pay $\$5 + x$ now`,
  "Add $x + US$5$ here",
  "An empty $$ $$ stays text",
  "$$ $$ is empty, but $$x$$ is not",
  String.raw`Doubled \\(x^2\\) and \\[y^2\\] backslashes`,
  "An unclosed $x + 1 formula",
  "$ x$ has a space after its opener",
  "$x$5 is not math",
  String.raw`Größe $\alpha$ ist ß, 東京 $β$ 🚀`,
  String.raw`Compare $a$, $$b$$, \(c\) and \[d\] at once`,
  "A byte order mark after $\uFEFFx$ isn't math",
  "A next-line mark after $\u0085x$ is math",
  "Display $$\u0085x\uFEFF$$ trims like JavaScript",
  "Match `^a$|^b$` against $x$, but not `$y$`",
  "The cost is $5; print `$HOME`.",
] as const;

describe("lesson math as native players must split it", () => {
  it("splits each case at the math the TypeScript finder finds", async () => {
    const cases = CASES.map((text) => ({
      segments: splitAtMath(text).map((segment) => ({ kind: segment.kind, text: segment.text })),
      text,
    }));

    await expect(`${JSON.stringify({ cases }, null, 2)}\n`).toMatchFileSnapshot(
      "math-spans-native-fixtures.json",
    );
  });
});
