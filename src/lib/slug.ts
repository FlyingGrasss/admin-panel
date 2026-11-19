const TURKISH_ASCII: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

function toAscii(value: string): string {
  return value
    .normalize("NFC")
    .split("")
    .map((character) => TURKISH_ASCII[character] ?? character)
    .join("");
}

/** URL-safe collection slug: Turkish characters converted, lowercase, dashes. */
export function slugify(value: string, maxLength = 48): string {
  return toAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Field keys only allow lowercase letters, digits, and underscores. */
export function fieldKeyFromLabel(value: string, maxLength = 40): string {
  return toAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength)
    .replace(/_+$/g, "");
}
