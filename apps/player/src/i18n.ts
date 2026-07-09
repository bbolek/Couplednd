import en from "@familyquest/shared/i18n/en";
import tr from "@familyquest/shared/i18n/tr";
import type { Language } from "@familyquest/shared";

/**
 * Featherweight i18n for the player bundle (kept small on purpose — this
 * whole SPA is served from a phone). Dot-path keys + {{var}} interpolation,
 * matching the resource format the host app uses with i18next.
 */

type Dict = Record<string, unknown>;
const resources: Record<Language, Dict> = { en, tr };

let current: Language = "en";

export function setLanguage(lang: Language): void {
  current = lang;
}

export function getLanguage(): Language {
  return current;
}

function lookup(dict: Dict, path: string): string | undefined {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  // Plural suffix convention mirrors i18next: `key_other` for count !== 1.
  let path = key;
  if (vars && typeof vars.count === "number" && vars.count !== 1) {
    const plural = lookup(resources[current], `${key}_other`);
    if (plural !== undefined) path = `${key}_other`;
  }
  const template = lookup(resources[current], path) ?? lookup(resources.en, path) ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{{${name}}}`,
  );
}
