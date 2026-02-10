import { type AxiosError, isAxiosError } from "axios";
import { ErrorPriority } from "../contants";
import { type AppErrorResponse, ErrorPlugin, type ExpectedAny } from "../types";

/**
 * Plugin for handling Axios errors and extracting server-side data.
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
	 * Maps HTTP response details to the global schema
	 */
	serialize(error: AxiosError): AppErrorResponse {
		const responseData = error.response?.data as ExpectedAny;

		const backendMessage =
			responseData?.message || responseData?.error?.message;
		const backendCode = responseData?.code || responseData?.errorCode;

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
		});
	}
}
