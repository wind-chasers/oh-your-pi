import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PiAuthenticationEvent } from "@shared/pi-contract";
import { AuthenticationStep } from "./AuthenticationStep";

function prompt(allowsEmpty?: boolean): PiAuthenticationEvent {
	return {
		provider: "github-copilot",
		type: "prompt",
		message: "GitHub Enterprise URL/domain (blank for github.com)",
		url: null,
		userCode: null,
		promptId: "prompt-id",
		placeholder: "company.ghe.com",
		inputType: "text",
		allowsEmpty,
		options: [],
	};
}

function renderPrompt(event: PiAuthenticationEvent): string {
	return renderToStaticMarkup(
		<AuthenticationStep
			login={{
				event,
				provider: {
					loginMethods: ["oauth"],
					name: "GitHub Copilot",
					provider: "github-copilot",
					status: "unavailable",
					type: null,
				},
				status: "active",
			}}
			onPromptSubmit={async () => {}}
			onReturnToProviders={async () => {}}
			onSelect={async () => {}}
			promptValue=""
			setPromptValue={() => {}}
		/>,
	);
}

test("允许空值的认证提示可直接继续", () => {
	expect(renderPrompt(prompt(true))).not.toContain('disabled=""');
});

test("默认认证提示仍要求输入", () => {
	expect(renderPrompt(prompt())).toContain('disabled=""');
});
