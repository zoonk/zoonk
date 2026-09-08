import { ANDROID_ROOT, untrackedCatalogs } from "./catalogs.mts";

const untracked = await untrackedCatalogs(ANDROID_ROOT);

if (untracked.length > 0) {
  throw new Error(
    `Translatable resources outside Eloqnt's catalogs:\n${untracked.join("\n")}\n` +
      "Keep copy in res/values/strings.xml and its configured locale files, or extend the localization pipeline.",
  );
}
