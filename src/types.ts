import { ErrorPriority } from "./constants";

/**
 * Standardized error response structure used by all plugins.
 */
export interface AppErrorResponse {
  /**
   * Metadata about the serialization process
   */
  metadata: {
    /**
     * Name of the plugin that handled the error
     */
    plugin: string;

    /**
     * Priority level of the handler
     */
    priority: number;
  };

  /**
   * The original error object that was processed
   */
  error: unknown;

  /**
   * Global error message or description
   */
  global?: string;

  /**
   * List of specific error codes
   */
  code?: string[];

  /**
   * HTTP status code if applicable
   */
  status?: number;

  /**
   * Map of field-level validation errors
   */
  validation?: Record<string, ExpectedAny>;
}

/**
 * Callback function triggered after error processing.
 */
export type SerializationCallback = (context: AppErrorResponse) => void;

/**
 * Configuration options for Zod error serialization.
 */
export interface ZodSerializationOptions {
  /**
   * Structure of the validation object:
   * - 'flat': keys like "user_name"
   * - 'nested': hierarchical objects
   */
  structure: "flat" | "nested";

  /**
   * Format of validation messages:
   * - 'array': list of strings
   * - 'string': first error message only
   */
  messageFormat: "array" | "string";

  /**
   * Separator for flat keys
   */
  keySeparator?: string;

  /**
   * Custom mapper to override message or code for specific Zod issues.
   */
  mapIssue?: (
    issue: ExpectedAny,
  ) => { code?: string; message?: string } | undefined;
}

/**
 * Abstract base class for error plugins with unified response formatting.
 */
export abstract class ErrorPlugin<T = unknown> {
  /**
   * Unique identifier for the plugin
   */
  public abstract readonly name: string;

  /**
   * @param priority - Determines execution order (higher values run first)
   */
  protected constructor(
    public priority: (typeof ErrorPriority)[keyof typeof ErrorPriority] = ErrorPriority.StandardError,
  ) {}

  /**
   * Determines if the error is compatible with this plugin.
   */
  abstract match(error: unknown): error is T;

  /**
   * Transforms the error into the standardized AppErrorResponse.
   */
  abstract serialize(error: T): AppErrorResponse;

  /**
   * Internal helper to maintain consistent metadata and structure.
   */
  protected createResponse(
    error: T,
    params: Omit<AppErrorResponse, "metadata" | "error">,
  ): AppErrorResponse {
    return {
      metadata: {
        plugin: this.name,
        priority: this.priority,
      },
      error,
      ...params,
    };
  }
}

/**
 * Type alias for any-type values in structured objects.
 */
// biome-ignore lint/suspicious/noExplicitAny: Type alias for any-type values in structured objects.
export type ExpectedAny = any;
