import type {
	PiAuthenticationEvent,
	PiAuthenticationMethod,
	PiAuthenticationStatus,
} from "@shared/pi-contract";

export type ActiveLogin = {
	event: PiAuthenticationEvent | undefined;
	provider: PiAuthenticationStatus;
	status: "active" | "complete";
};

export type ProviderLoginHandler = (
	provider: PiAuthenticationStatus,
	method: PiAuthenticationMethod,
) => Promise<void>;
