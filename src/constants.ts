/**
 * Priority levels for different error types.
 * Plugins with higher priority are checked first in the pipeline.
 */
export const ErrorPriority = {
	/**
	 * Fallback priority for unhandled errors
	 */
	FallbackError: -1,

	/**
	 * Default priority for generic errors
	 */
	StandardError: 0,

	/**
	 * Priority for HTTP-related errors
	 */
	AxiosError: 1,

	/**
	 * High priority for validation-related errors
	 */
	ZodError: 2,
} as const;
