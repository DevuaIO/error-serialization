import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ErrorPriority } from "./constants";
import {
  AxiosErrorPlugin,
  ErrorSerializer,
  StandardErrorPlugin,
  ZodErrorPlugin,
} from "./index";
import type { ExpectedAny } from "./types";

/**
 * Comprehensive test suite for the error serialization system.
 */
describe("Error Serialization Exhaustive Tests", () => {
  /**
   * Tests for core orchestrator logic.
   */
  describe("ErrorSerializer Orchestration", () => {
    it("should work with zero registered plugins using absolute fallback", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(new Error("Generic"));

      expect(result.metadata.plugin).toBe("ErrorSerializer");
      expect(result.metadata.priority).toBe(ErrorPriority.FallbackError);
      expect(result.code).toEqual(["UNHANDLED_EXCEPTION"]);
    });

    it("should respect plugin priority even if registered in wrong order", () => {
      const serializer = new ErrorSerializer();
      serializer.register(new StandardErrorPlugin());
      serializer.register(new ZodErrorPlugin());

      const zodError = new ZodError([]);
      const result = serializer.process(zodError);

      expect(result.metadata.plugin).toBe("ZodErrorPlugin");
    });

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
   * Edge cases for various input types.
   */
  describe("Edge Case Inputs", () => {
    it("should handle null as an error input", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(null);

      expect(result.global).toBe("null");
      expect(result.metadata.plugin).toBe("ErrorSerializer");
    });

    it("should handle numeric error inputs", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(500);

      expect(result.global).toBe("500");
    });

    it("should handle undefined error inputs", () => {
      const serializer = new ErrorSerializer();
      const result = serializer.process(undefined);

      expect(result.global).toBe("undefined");
    });
  });

  /**
   * ZodErrorPlugin cases (paths, symbols, nesting).
   */
  describe("ZodErrorPlugin Advanced Scenarios", () => {
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
   * AxiosErrorPlugin scenarios (API, network, HTML responses).
   */
  describe("AxiosErrorPlugin Exhaustive Scenarios", () => {
    /**
     * Verifies basic extraction of validationErrors.
     */
    it("should extract validationErrors from backend response", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Unprocessable Entity");
      const mockValidationErrors = {
        organization_user_id: ["Must be a number"],
        method_id: ["Required"],
      };

      axiosError.response = {
        status: 422,
        data: {
          message: "Validation error",
          errorCode: ["102"],
          validationErrors: mockValidationErrors,
        },
        config: {} as ExpectedAny,
        headers: {},
        statusText: "Unprocessable Entity",
      };

      const result = plugin.serialize(axiosError);

      expect(result.status).toBe(422);
      expect(result.validation).toEqual({
        organization_user_id: "Must be a number",
        method_id: "Required",
      });
    });

    /**
     * Verifies flattening and single-value extraction from nested arrays.
     */
    it("should flatten nested objects and extract single values from arrays", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Unprocessable Entity");

      const mockNestedValidation = {
        user: {
          email: ["Invalid format"], // Array with 1 element -> string
          roles: ["Admin", "Editor"], // Array with >1 element -> array
        },
        status: [400], // Number in array -> number
      };

      axiosError.response = {
        status: 422,
        data: {
          message: "Validation error",
          validationErrors: mockNestedValidation,
        },
        config: {} as ExpectedAny,
        headers: {},
        statusText: "Unprocessable Entity",
      };

      const result = plugin.serialize(axiosError);

      expect(result.validation).toEqual({
        "user.email": "Invalid format",
        "user.roles": ["Admin", "Editor"],
        status: 400,
      });
    });

    it("should handle Network Errors (no response from server)", () => {
      const plugin = new AxiosErrorPlugin();
      const axiosError = new AxiosError("Network Error");
      axiosError.code = "ERR_NETWORK";

      const result = plugin.serialize(axiosError);
      expect(result.status).toBe(0);
      expect(result.code).toEqual(["HTTP_0"]);
    });

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
