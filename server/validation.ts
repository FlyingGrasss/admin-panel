import type { Validated } from "../shared/validation.js";
import { validationError } from "./errors.js";

export function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw validationError(result.error.field, result.error.message);
  return result.value;
}
