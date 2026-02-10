import { ErrorPriority } from "./constants";
import type {
  AppErrorResponse,
  ErrorPlugin,
  ExpectedAny,
  SerializationCallback,
} from "./types";

/**
 * Core engine for error processing that manages plugin lifecycle and post-processing callbacks.
 */
export class ErrorSerializer {
  /**
   * List of registered serialization plugins.
   */
  private plugins: ErrorPlugin<ExpectedAny>[] = [];

  /**
   * Registered callbacks triggered after serialization.
   */
  private callbacks: SerializationCallback[] = [];

  /**
   * Registers a plugin and sorts the pipeline by priority.
   */
  register(plugin: ErrorPlugin<ExpectedAny>): this {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Adds a global callback triggered for every processed error.
   */
  subscribe(callback: SerializationCallback): this {
    this.callbacks.push(callback);
    return this;
  }

  /**
   * Orchestrates the serialization process.
   * Returns a standardized response even for primitive types or null.
   */
  process(error: unknown): AppErrorResponse {
    let output: AppErrorResponse | null = null;

    for (const plugin of this.plugins) {
      if (plugin.match(error)) {
        output = plugin.serialize(error);
        break;
      }
    }

    if (!output) {
      output = {
        metadata: {
          plugin: "ErrorSerializer",
          priority: ErrorPriority.FallbackError,
        },
        error,
        global: String(error),
        code: ["UNHANDLED_EXCEPTION"],
      };
    }

    /**
     * Trigger callbacks with the AppErrorResponse directly.
     */
    for (const callback of this.callbacks) {
      callback(output);
    }

    return output;
  }
}
