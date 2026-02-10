# @devua-lab/error-serialization

A lightweight, highly extensible TypeScript library for standardized error serialization. It provides a unified pipeline to transform any error—from Zod validation issues and Axios HTTP failures to native JavaScript errors and raw strings—into a consistent, strictly typed response format.

---

## 📑 Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Usage Guide](#usage-guide)
   - [1. Setup & Registration](#1-setup--registration)
   - [2. Processing Errors](#2-processing-errors)
   - [3. Global Subscriptions](#3-global-subscriptions)
5. [Standard Response Format](#standard-response-format)
6. [Standard Plugins](#standard-plugins)
   - [ZodErrorPlugin](#zoderrorplugin)
   - [AxiosErrorPlugin](#axioserrorplugin)
   - [StandardErrorPlugin](#standarderrorplugin)
7. [Priority System](#priority-system)

---

## ✨ Features

- **🎯 Universal Standardization**: Regardless of the error source, the output always follows the same predictable interface.
- **🏗️ Structured Validation Mapping**: Advanced transformation of Zod issues into flat keys or deep object hierarchies.
- **🌐 Generic API Extraction**: Smart parsing of backend error messages and codes from HTTP responses.
- **🚀 Priority-Based Execution**: Automatically selects the most appropriate handler.
- **🔔 Real-time Subscriptions**: Simple callback system for global error monitoring.
- **🛡️ Preservation of Context**: Access low-level details (like Axios request configs) via the preserved original error.

---

## 📦 Installation

```bash
npm install @devua-lab/error-serialization
```

### Peer Dependencies
This library requires `axios` and `zod` to be installed in your project as peer dependencies:

```bash
npm install axios zod
```

---

## 🚀 Quick Start

```typescript
import { ErrorSerializer, ZodErrorPlugin, AxiosErrorPlugin } from '@devua-lab/error-serialization';

// 1. Initialize
const serializer = new ErrorSerializer();

// 2. Register plugins
serializer
  .register(new AxiosErrorPlugin())
  .register(new ZodErrorPlugin({ structure: 'nested' }));

// 3. Use in your application
try {
  await api.post('/login', data);
} catch (error) {
  const result = serializer.process(error);
  console.log(result.global); // "Invalid credentials"
  console.log(result.status); // 401
}
```

---

## 🛠 Usage Guide

### 1. Setup & Registration
Create a central error utility in your app to reuse the serializer instance. Register plugins in any order; the library will sort them by internal priority.

```typescript
// error-utility.ts
import { 
  ErrorSerializer, 
  ZodErrorPlugin, 
  AxiosErrorPlugin, 
  StandardErrorPlugin 
} from '@devua-lab/error-serialization';

export const errorSerializer = new ErrorSerializer();

errorSerializer
  .register(new StandardErrorPlugin())
  .register(new AxiosErrorPlugin())
  .register(new ZodErrorPlugin({ 
    structure: 'flat', 
    messageFormat: 'string' 
  }));
```

### 2. Processing Errors
Simply wrap your logic in a `try/catch` block and pass the caught error to the `process` method.

```typescript
import { errorSerializer } from './error-utility';

async function handleSubmit(formData: any) {
  try {
    const validated = schema.parse(formData);
    await userService.create(validated);
  } catch (err) {
    const error = errorSerializer.process(err);

    if (error.status === 422) {
      // Handle validation errors in UI
      setFormErrors(error.validation);
    } else {
      // Show global notification
      toast.error(error.global || "Something went wrong");
    }
  }
}
```

### 3. Global Subscriptions
Use subscriptions to automate logging or reporting without cluttering your business logic.

```typescript
errorSerializer.subscribe((context) => {
  // Report critical errors to Sentry
  if (context.status && context.status >= 500) {
    Sentry.captureException(context.error);
  }

  // Analytics for specific error codes
  if (context.code?.includes('AUTH_EXPIRED')) {
    analytics.track('Session Timeout');
  }
});
```

---

## 🏗 Standard Response Format

The `process` method always returns an `AppErrorResponse` object:

```typescript
{
  metadata: {
    plugin: string;    // Plugin name (e.g., "ZodErrorPlugin" or "ErrorSerializer" for fallbacks)
    priority: number;  // Level (2: Zod, 1: Axios, 0: Standard, -1: Fallback)
  },
  error: unknown;      // The ORIGINAL error object
  global?: string;     // Main human-readable message
  code?: string[];     // Array of error codes (e.g., ["102", "CONFLICT"])
  status?: number;     // Numeric status code (e.g., 422, 500, or 0)
  validation?: {       // Object with field-level errors
    [key: string]: any;
  }
}
```

---

## ⚙️ Priority System 

| Plugin | Priority | Matching Criteria |
| :--- | :--- | :--- |
| **ZodErrorPlugin** | 2 | `instanceof ZodError` |
| **AxiosErrorPlugin** | 1 | `axios.isAxiosError(error)` |
| **StandardErrorPlugin** | 0 | `instanceof Error` |
| **ErrorSerializer** | -1 | Fallback for raw strings, numbers, or null |