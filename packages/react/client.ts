import * as React from "react";

export type Navigation =
	| {
			state: "idle";
	  }
	| {
			state: "loading";
	  };

const IDLE = { state: "idle" } satisfies Navigation;

export function useNavigation() {
	return React.useSyncExternalStore<Navigation>(
		(onStoreChange) => {
			// @ts-expect-error
			__oneup.nc = __oneup.nc || new Set();
			const cb = () => {
				onStoreChange();
			};
			// @ts-expect-error
			__oneup.nc.add(cb);
			return () => {
				// @ts-expect-error
				__oneup.nc.delete(cb);
			};
		},
		() => {
			// @ts-expect-error
			if (!__oneup.n) {
				return IDLE;
			}
			// @ts-expect-error
			return __oneup.n;
		},
		() => IDLE
	);
}
