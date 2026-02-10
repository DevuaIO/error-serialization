import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ErrorPriority } from "./contants";
import {
  AxiosErrorPlugin,
  ErrorSerializer,
  StandardErrorPlugin,
  ZodErrorPlugin,
} from "./index";
import type { ExpectedAny } from "./types";

/**
 * Exhaustive test suite for the Error Serialization system.
 */
describe("Error Serialization Exhaustive Tests", () => {
  /**
   * Tests covering the main orchestrator logic.
   */
  describe("ErrorSerializer Orchestration", () => {
    /**
     * Verifies that the serializer provides a fallback when no plugins are registered.
     */
    it("should work with zero registered plugins using absolute fallback", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(new Error("Generic"));

      expect(result.metadata.plugin).toBe("ErrorSerializer");
      expect(result.metadata.priority).toBe(ErrorPriority.FallbackError);
      expect(result.code).toEqual(["UNHANDLED_EXCEPTION"]);
    });

    /**
     * Ensures that plugins are executed according to their priority, not registration order.
     */
    it("should respect plugin priority even if registered in wrong order", () => {
      const serializer = new ErrorSerializer();
      serializer.register(new StandardErrorPlugin());
      serializer.register(new ZodErrorPlugin());

      const zodError = new ZodError([]);
      const result = serializer.process(zodError);

      expect(result.metadata.plugin).toBe("ZodErrorPlugin");
    });

    /**
     * Checks if the subscription system correctly passes the output to callbacks.
     */
    it("should trigger callbacks with AppErrorResponse as the first argument", () => {
      const serializer = new ErrorSerializer();
      const callback = vi.fn();
      serializer.subscribe(callback);

      const output = serializer.process("Simple string error");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(output);
    });
  });

  /**
   * Edge cases for unconventional input types.
   */
  describe("Edge Case Inputs", () => {
    /**
     * Verifies handling of null values.
     */
    it("should handle null as an error input", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(null);

      expect(result.global).toBe("null");
      expect(result.metadata.plugin).toBe("ErrorSerializer");
    });

    /**
     * Verifies handling of numeric values.
     */
    it("should handle numeric error inputs", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(500);

      expect(result.global).toBe("500");
    });

    /**
     * Verifies handling of undefined values.
     */
    it("should handle undefined error inputs", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(undefined);

      expect(result.global).toBe("undefined");
    });
  });

  /**
   * Deep Zod path and structural transformation tests.
   */
  describe("ZodErrorPlugin Advanced Scenarios", () => {
    /**
     * Ensures Symbol keys are ignored during path stringification.
     */
    it("should filter out Symbol keys from Zod paths", () => {
      const plugin = new ZodErrorPlugin({ structure: "flat" });
      const sym = Symbol("private");
      const zodError = new ZodError([
        {
          code: "custom",
          path: ["user", sym as ExpectedAny, "name"],
          message: "Error",
        },
      ] as ExpectedAny);

      const result = plugin.serialize(zodError);
      expect(result.validation).toHaveProperty("user_name");
    });

    /**
     * Verifies fallback to default behavior when mapIssue returns nothing.
     */
    it("should handle mapIssue returning nothing (fallback to default)", () => {
      const plugin = new ZodErrorPlugin({
        mapIssue: () => undefined,
      });
      const zodError = new ZodError([
        { code: "custom", path: ["f"], message: "Default" },
      ] as ExpectedAny);

      const result = plugin.serialize(zodError);
      expect(result.validation?.f).toEqual(["Default"]);
    });

    /**
     * Ensures numeric indices in paths are treated as object keys in nested mode.
     */
    it("should correctly handle array index as string keys in nested objects", () => {
      const plugin = new ZodErrorPlugin({
        structure: "nested",
        messageFormat: "string",
      });
      const zodError = new ZodError([
        { code: "custom", path: ["user", 0, "org", 1, "n"], message: "Msg" },
      ] as ExpectedAny);

      const result = plugin.serialize(zodError);
      expect(result.validation).toEqual({
        user: { "0": { org: { "1": { n: "Msg" } } } },
      });
    });
  });

  /**
   * Network, HTTP, and API-specific scenarios for Axios.
   */
  describe("AxiosErrorPlugin Exhaustive Scenarios", () => {
    /**
     * Verifies that nested validationErrors are automatically flattened.
     */
    it("should extract and flatten nested validationErrors from backend response", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Unprocessable Entity");

      const mockNestedValidation = {
        user: {
          profile: {
            name: ["Must be a string"],
            age: ["Required"],
          },
          settings: {
            theme: "Invalid theme",
          },
        },
      };

      axiosError.response = {
        status: 422,
        data: {
          message: "Validation error",
          errorCode: ["102"],
          validationErrors: mockNestedValidation,
        },
        config: {} as ExpectedAny,
        headers: {},
        statusText: "Unprocessable Entity",
      };

      const result = plugin.serialize(axiosError);

      expect(result.status).toBe(422);
      expect(result.validation).toEqual({
        "user.profile.name": ["Must be a string"],
        "user.profile.age": ["Required"],
        "user.settings.theme": "Invalid theme",
      });
    });

    /**
     * Ensures the plugin handles cases where the server cannot be reached.
     */
    it("should handle Network Errors (no response from server)", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Network Error");
      axiosError.code = "ERR_NETWORK";

      const result = plugin.serialize(axiosError);
      expect(result.status).toBe(0);
      expect(result.code).toEqual(["HTTP_0"]);
    });

    /**
     * Verifies resilience when the response data is not a structured object.
     */
    it("should handle empty or non-object response data (e.g. 502 Bad Gateway)", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Bad Gateway");
      axiosError.response = {
        status: 502,
        data: "<html>Error</html>",
        config: {} as ExpectedAny,
        headers: {},
        statusText: "Bad Gateway",
      };

      const result = plugin.serialize(axiosError);
      expect(result.status).toBe(502);
      expect(result.global).toBe("Bad Gateway");
    });
  });
});
