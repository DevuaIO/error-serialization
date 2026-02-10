import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Включаем глобальные переменные (describe, it, expect)
		globals: true,

		// Для Node.js проектов (бэкенд, скрипты, библиотеки) используем 'node'.
		// Если тестируете DOM (но без браузера), можно поставить 'happy-dom' (надо установить отдельно).
		environment: "node",

		// Где искать тесты
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

		// Настройки покрытия кода (опционально)
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
		},
	},
});
