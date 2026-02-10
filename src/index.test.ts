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
		it("should work with zero registered plugins using absolute fallback", () => {
			const serializer = new ErrorSerializer();
			const result = serializer.process(new Error("Generic"));

			expect(result.metadata.plugin).toBe("ErrorSerializer");
			expect(result.metadata.priority).toBe(ErrorPriority.FallbackError);
			expect(result.code).toEqual(["UNHANDLED_EXCEPTION"]);
		});

		it("should respect plugin priority even if registered in wrong order", () => {
			const serializer = new ErrorSerializer();
			serializer.register(new StandardErrorPlugin()); // Priority 0
			serializer.register(new ZodErrorPlugin()); // Priority 2

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
	 * Edge cases for input types.
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
	 * Deep Zod path and structural tests.
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
	 * Network and Axios specific tests.
	 */
	describe("AxiosErrorPlugin Exhaustive Scenarios", () => {
		it("should handle Network Errors (no response from server)", () => {
			const plugin = new AxiosErrorPlugin();
			const axiosError = new AxiosError("Network Error");
			axiosError.code = "ERR_NETWORK";

			const result = plugin.serialize(axiosError);
			expect(result.status).toBe(0);
			expect(result.code).toEqual(["HTTP_0"]);
			expect(result.global).toBe("Network Error");
		});

		it("should handle empty response data (e.g. 502 Bad Gateway with HTML)", () => {
			const plugin = new AxiosErrorPlugin();
			const axiosError = new AxiosError("Bad Gateway");
			axiosError.response = {
				status: 502,
				data: "<html lang='en'>Error</html>",
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
