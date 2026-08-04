import { describe, expect, test } from "bun:test";
import { parseNpmPluginSource } from "./npm-source";

describe("parseNpmPluginSource", () => {
	test.each([
		["pi install npm:piolium", "npm:piolium"],
		["npm:piolium", "npm:piolium"],
		["piolium", "npm:piolium"],
		["pi install npm:@vigolium/piolium", "npm:@vigolium/piolium"],
		["npm:@vigolium/piolium", "npm:@vigolium/piolium"],
		["@vigolium/piolium", "npm:@vigolium/piolium"],
	])("规范化 %s", (input, expected) => {
		expect(parseNpmPluginSource(input)).toBe(expected);
	});

	test.each([
		"",
		"pi install git:https://github.com/user/repo",
		"https://github.com/user/repo",
		"npm:vigolium/piolium",
		"pi install npm:vigolium/piolium",
		"@vigolium",
		"vigolium/piolium",
		"invalid value",
	])("拒绝 %s", (input) => {
		expect(parseNpmPluginSource(input)).toBeUndefined();
	});
});
