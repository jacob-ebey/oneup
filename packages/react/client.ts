"use client";
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

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback: React.ReactNode;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	{ error: unknown }
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);

		this.state = { error: null };
		this.onNavigationStateChanged = this.onNavigationStateChanged.bind(this);
	}

	static getDerivedStateFromError(error: unknown) {
		return { error };
	}

	onNavigationStateChanged() {
		if (
			// @ts-expect-error
			__oneup.n.state === "idle" &&
			this.state.error
		) {
			this.setState({ error: null });
		}
	}

	componentDidMount() {
		// @ts-expect-error
		__oneup.nc = __oneup.nc || new Set();
		// @ts-expect-error
		__oneup.nc.add(this.onNavigationStateChanged);
	}

	componentWillUnmount(): void {
		// @ts-expect-error
		__oneup.nc.delete(this.onNavigationStateChanged);
	}

	render() {
		if (this.state.error) {
			return this.props.fallback;
		}

		return this.props.children;
	}
}
