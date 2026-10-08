import { lang } from "next/root-params";

/**
 * The home page's example goal is a move abroad: speaking the language there. A page never
 * suggests learning the language it's written in, so Spanish pages move to London to speak
 * English, and every other page moves to Madrid to speak Spanish.
 */
export type ExampleMove = "london" | "madrid";

export async function getExampleMove(): Promise<ExampleMove> {
  return (await lang()) === "es" ? "london" : "madrid";
}
