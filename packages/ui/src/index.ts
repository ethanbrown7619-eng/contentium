export * from "./tokens";
export * from "./apps";

/** Tiny classname combiner — join truthy strings, no dependency. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
