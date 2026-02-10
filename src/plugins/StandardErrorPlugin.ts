import { ErrorPriority } from "../contants";
import { type AppErrorResponse, ErrorPlugin } from "../types";

/**
 * Basic plugin for standard JavaScript Error objects.
 */
export class StandardErrorPlugin extends ErrorPlugin<Error> {
	/**
	 * Plugin identifier
	 */
	public readonly name = "StandardErrorPlugin";

	constructor() {
		super(ErrorPriority.StandardError);
	}

	/**
	 * Matches native Error class
	 */
	match(error: unknown): error is Error {
		return error instanceof Error;
	}

	/**
	 * Converts native Error to standardized response
	 */
	serialize(error: Error): AppErrorResponse {
		return this.createResponse(error, {
			global: error.message,
			code: ["INTERNAL_ERROR"],
		});
	}
}
