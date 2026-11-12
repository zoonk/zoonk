"use client";

import { useEffect, useState } from "react";
import { useLoadCountries } from "../learn-context";
import { type CountryChoice } from "./country-choice";

type CatalogState =
  | { countries: CountryChoice[]; status: "ready" }
  | { countries: null; status: "failed" | "loading" };

const LOADING: CatalogState = { countries: null, status: "loading" };

/** One read per language for the page's life: every picker on it shares the same list. */
const loaded = new Map<string, Promise<CountryChoice[] | null>>();

/** Read the first time a picker opens, never with the page: no page carries 250 names. */
export function useCountryCatalog({ enabled, language }: { enabled: boolean; language: string }) {
  const loadCountries = useLoadCountries();
  const [state, setState] = useState<CatalogState>(LOADING);
  const needed = enabled && state.status === "loading";

  useEffect(() => {
    if (!needed) {
      return;
    }

    const request = loaded.get(language) ?? loadCountries(language).catch(() => null);
    loaded.set(language, request);

    let current = true;

    void request.then((countries) => {
      if (!countries) {
        loaded.delete(language);
      }

      if (current) {
        setState(
          countries ? { countries, status: "ready" } : { countries: null, status: "failed" },
        );
      }
    });

    return () => {
      current = false;
    };
  }, [language, loadCountries, needed]);

  return { countries: state.countries, retry: () => setState(LOADING), status: state.status };
}
