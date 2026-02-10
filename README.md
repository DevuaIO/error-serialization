# Error Serializer Library

A lightweight, highly extensible TypeScript library for standardized error serialization. It provides a unified pipeline to transform any error—from Zod validation issues and Axios HTTP failures to native JavaScript errors and raw strings—into a consistent, strictly typed response format.

---

## 📑 Table of Contents

1. [Features](#features)
2. [Standardized Output Format](#standardized-output-format)
3. [Out-of-the-Box Functionality](#out-of-the-box-functionality)
    - [ZodErrorPlugin](#zoderrorplugin)
    - [AxiosErrorPlugin](#axioserrorplugin)
    - [StandardErrorPlugin](#standarderrorplugin)
4. [Core Orchestration](#core-orchestration)
    - [Priority System](#priority-system)
    - [Subscription System (Callbacks)](#subscription-system-callbacks)
5. [Advanced Usage](#advanced-usage)
6. [Test Coverage & Reliability](#test-coverage--reliability)

---

## ✨ Features

- **🎯 Universal Standardization**: Regardless of the error source, the output always follows the same predictable interface.
- **🏗️ Structured Validation Mapping**: Advanced transformation of Zod issues into flat keys or deep object hierarchies.
- **🌐 Generic API Extraction**: Smart parsing of backend error messages and codes from HTTP responses.
- **🚀 Priority-Based Execution**: Automatically selects the most appropriate handler for any given error object.
- **🔔 Real-time Subscriptions**: Lightweight callback system for global error monitoring and analytics.
- **🛡️ Preservation of Context**: The original error object is always preserved, allowing access to low-level details (like Axios request configs).
- **🔌 Plugin-Driven**: Easily register new handlers for custom application-specific error classes.

---

## 🏗 Standardized Output Format

The serialization process produces an `AppErrorResponse` object:

```typescript
{
  metadata: {
    plugin: string;    // The plugin that successfully handled the error
    priority: number;  // Priority level of the handling plugin
  },
  error: unknown;      // The ORIGINAL error object (preserved for logging/debugging)
  global?: string;     // A primary human-readable error message
  code?: string[];     // Standardized error identifiers (e.g., ["102", "CONFLICT"])
  status?: number;     // Numeric status code (e.g., 422, 404, 500, or 0 for network issues)
  validation?: {       // Detailed field-level errors (primarily for Zod)
    [key: string]: any;
  }
}
```

---

## 📦 Out-of-the-Box Functionality

### ZodErrorPlugin
Designed for `ZodError` instances. It translates complex validation issues into formats suitable for frontend state.
- **Status Code**: Returns `422`.
- **Default Code**: `["102"]`.
- **Flexible Pathing**: Correctly handles array indices (e.g., `list.0.name`) and nested properties.
- **Customizable**: Use `mapIssue` to dynamically rewrite messages or inject specific codes based on validation parameters.

### AxiosErrorPlugin
A generic handler for `AxiosError`. It is designed to work with virtually any backend error structure.
- **Message Parsing**: Scans the response body for `message` or `error.message`.
- **Code Parsing**: Extracts `code` or `errorCode` from response data.
- **Network Awareness**: Provides fallback status `0` and generic codes (e.g., `HTTP_0`) when a server response is absent (Network Error).

### StandardErrorPlugin
The baseline handler for native `Error` objects, ensuring even basic exceptions are standardized.
- **Code**: `["INTERNAL_ERROR"]`.
- **Message**: Uses the native `error.message`.

---

## ⚙️ Core Orchestration

### Priority System
Plugins are ordered by priority. The `ErrorSerializer` iterates through them until it finds a match.

| Plugin                  | Priority | Matching Criteria                      |
|:------------------------|:---------|:---------------------------------------|
| **ZodErrorPlugin**      | 2        | `instanceof ZodError`                  |
| **AxiosErrorPlugin**    | 1        | `axios.isAxiosError(error)`            |
| **StandardErrorPlugin** | 0        | `instanceof Error`                     |
| **FallbackError**       | -1       | Fallback priority for unhandled errors |

### Subscription System (Callbacks)
Register callbacks to listen to every serialization event. Since the original error is preserved in the output, you can extract any context needed.

```typescript
serializer.subscribe((context) => {
  // Access Axios config via the original error preservation
  if (context.metadata.plugin === 'AxiosErrorPlugin') {
    const originalAxiosError = context.error as AxiosError;
    console.log('Request URL:', originalAxiosError.config?.url);
  }
  
  // Log all critical status codes
  if (context.status && context.status >= 500) {
    MyMonitor.log(context.global);
  }
});
```

---

## 🚀 Advanced Usage

### Custom Zod Mapping
```typescript
const plugin = new ZodErrorPlugin({
  mapIssue: (issue) => {
    if (issue.params?.apiCode) {
      return { code: issue.params.apiCode, message: issue.message };
    }
  }
});
```

---

## 🧪 Test Coverage & Reliability

The library is fully verified with `vitest` against a wide range of scenarios:
- **General Backend Errors**: Extraction of custom error codes and messages from various API response formats.
- **Deeply Nested Validation**: Handling of paths like `['a', 0, 'b', 1, 'c']` in both flat and nested modes.
- **Symbol Key Safety**: Automatic filtering of `Symbol` keys in Zod paths to prevent serialization issues.
- **Boundary Inputs**: Graceful handling of `null`, `undefined`, and numeric inputs.
- **Connectivity Issues**: Accurate serialization of Axios network-level failures.
- **Subscription Integrity**: Confirmation that simplified callbacks receive the full `AppErrorResponse`.