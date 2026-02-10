import { type AxiosError, isAxiosError } from "axios";
import { ErrorPriority } from "../constants";
import { type AppErrorResponse, ErrorPlugin, type ExpectedAny } from "../types";

/**
 * Plugin for handling Axios errors and extracting server-side data.
 * Supports extraction of messages, error codes, and recursive validation errors
 * which are automatically flattened into a dot-notation structure.
 *
 * Special behavior: If a validation field contains an array with a single value,
 * it will be extracted as a direct value instead of an array.
 */
export class AxiosErrorPlugin extends ErrorPlugin<AxiosError> {
  /**
   * Plugin identifier
   */
  public readonly name = "AxiosErrorPlugin";

  constructor() {
    super(ErrorPriority.AxiosError);
  }

  /**
   * Uses Axios type guard to match errors
   */
  match(error: unknown): error is AxiosError {
    return isAxiosError(error);
  }

  /**
   * Maps HTTP response details to the global schema.
   * Flattens any nested validation error structures into a single-level object.
   */
  serialize(error: AxiosError): AppErrorResponse {
    const responseData = error.response?.data as ExpectedAny;

    /**
     * Extracting primary message from common backend patterns
     */
    const backendMessage =
      responseData?.message || responseData?.error?.message;

    /**
     * Extracting application-specific error codes
     */
    const backendCode = responseData?.code || responseData?.errorCode;

    /**
     * Extracting and flattening validation errors
     */
    const rawValidation =
      responseData?.validationErrors || responseData?.errors;
    const validation = rawValidation ? this.flatten(rawValidation) : undefined;

    const finalMessage = backendMessage || error.message || "Network Error";

    const finalCodes = backendCode
      ? Array.isArray(backendCode)
        ? backendCode
        : [String(backendCode)]
      : [`HTTP_${error.response?.status || 0}`];

    return this.createResponse(error, {
      global: finalMessage,
      code: finalCodes,
      status: error.response?.status || 0,
      validation,
    });
  }

  /**
   * Recursively flattens a nested object into a flat record with dot-separated keys.
   * Traverses nested objects but keeps arrays as leaf values.
   * If an array has exactly one element, it returns the element itself.
   */
  private flatten(
    obj: Record<string, ExpectedAny>,
    prefix = "",
  ): Record<string, ExpectedAny> {
    return Object.keys(obj).reduce((acc: Record<string, ExpectedAny>, k) => {
      const path = prefix ? `${prefix}.${k}` : k;
      const value = obj[k];

      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        Object.assign(
          acc,
          this.flatten(value as Record<string, ExpectedAny>, path),
        );
      } else {
        // Special rule: if array has only 1 item, extract it
        if (Array.isArray(value) && value.length === 1) {
          acc[path] = value[0];
        } else {
          acc[path] = value;
        }
      }

      return acc;
    }, {});
  }
}
