import { ZodError } from "zod";
import { ErrorPriority } from "../contants";
import {
	type AppErrorResponse,
	ErrorPlugin,
	type ExpectedAny,
	type ZodSerializationOptions,
} from "../types";

/**
 * Plugin specifically designed for Zod errors with advanced structural formatting.
 */
export class ZodErrorPlugin extends ErrorPlugin<ZodError> {
	/**
	 * Plugin identifier
	 */
	public readonly name = "ZodErrorPlugin";

	/**
	 * Private storage for serialization settings.
	 */
	private options: ZodSerializationOptions;

	/**
	 * @param options - Customization for error path and message formatting
	 */
	constructor(options: Partial<ZodSerializationOptions> = {}) {
		super(ErrorPriority.ZodError);
		this.options = {
			structure: "flat",
			messageFormat: "array",
			keySeparator: "_",
			...options,
		};
	}

	/**
	 * Checks if the error is an instance of ZodError
	 */
	match(error: unknown): error is ZodError {
		return error instanceof ZodError;
	}

	/**
	 * Serializes ZodError into the standardized format.
	 * Collects custom error codes if they are provided via mapIssue.
	 */
	serialize(error: ZodError): AppErrorResponse {
		const codes = new Set<string>(["102"]);
		const validation = this.formatIssues(error.issues, codes);

		return this.createResponse(error, {
			global: "Validation error",
			code: Array.from(codes),
			status: 422,
			validation,
		});
	}

	/**
	 * Processes Zod issues into the final validation object.
	 */
	protected formatIssues(
		issues: ZodError["issues"],
		codes: Set<string>,
	): Record<string, ExpectedAny> {
		const result: Record<string, ExpectedAny> = {};

		for (const issue of issues) {
			const path = issue.path.filter(
				(k): k is string | number =>
					typeof (k as string | number | symbol) !== "symbol",
			);

			let message = issue.message;

			if (this.options.mapIssue) {
				const mapped = this.options.mapIssue(issue);
				if (mapped) {
					if (mapped.message) message = mapped.message;
					if (mapped.code) codes.add(mapped.code);
				}
			}

			if (this.options.structure === "nested") {
				this.setNestedValue(result, path, message);
			} else {
				const key = path.join(this.options.keySeparator);
				this.setFlatValue(result, key, message);
			}
		}

		return result;
	}

	/**
	 * Handles flat object key generation
	 */
	private setFlatValue(obj: ExpectedAny, key: string, message: string) {
		if (this.options.messageFormat === "array") {
			if (!obj[key]) obj[key] = [];
			obj[key].push(message);
		} else {
			if (!obj[key]) obj[key] = message;
		}
	}

	/**
	 * Recursively builds nested object paths
	 */
	private setNestedValue(
		obj: ExpectedAny,
		path: (string | number)[],
		message: string,
	) {
		let current = obj;

		for (let i = 0; i < path.length; i++) {
			const key = path[i];
			const isLast = i === path.length - 1;

			if (isLast) {
				if (this.options.messageFormat === "array") {
					if (!current[key]) current[key] = [];
					if (Array.isArray(current[key])) {
						current[key].push(message);
					} else {
						current[key] = [message];
					}
				} else {
					current[key] = message;
				}
			} else {
				if (!current[key] || typeof current[key] !== "object") {
					current[key] = {};
				}
				current = current[key];
			}
		}
	}
}
