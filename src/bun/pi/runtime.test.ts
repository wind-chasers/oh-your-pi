import { expect, test } from "bun:test";
import { assertPiRuntimeCapabilities } from "./runtime";

test("桌面运行时必须提供 Bun.Image", () => {
	expect(() => assertPiRuntimeCapabilities({
		version: "1.3.13",
		Image: undefined,
	})).toThrow("需要 Bun 1.3.14 或更高版本");

	expect(() => assertPiRuntimeCapabilities({
		version: "1.3.14",
		Image: class {},
	})).not.toThrow();
});
