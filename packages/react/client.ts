"use client";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
// @ts-expect-error
import ReactDOMRSC from "react-server-dom-webpack/client";

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

export function getInitialRSCFetch() {
	return Promise.resolve(
		// @ts-expect-error
		__oneup.r
	);
}

function ReactServerComponent({
	done,
	rscChunk,
}: {
	done?: () => void;
	rscChunk: any;
}) {
	React.useEffect(() => {
		if (done) done();
	}, [done]);
	return React.use(rscChunk);
}

if (typeof window !== "undefined") {
	const webpackCache = new Map();
	window.__webpack_require__ = window.__webpack_chunk_load__ =
		window.__webpack_require__ ||
		((id) => {
			let p = webpackCache.get(id);
			if (p) return p;
			p = import(id);
			p = p.then(
				(v) => (p.value = v),
				(r) => {
					p.reason = r;
					throw r;
				}
			);
			webpackCache.set(id, p);
			return p;
		});
}

export function hydrateDocument() {
	let rscChunk = ReactDOMRSC.createFromFetch(getInitialRSCFetch());
	const root = ReactDOM.hydrateRoot(
		document,
		React.createElement(
			// @ts-expect-error
			ReactServerComponent,
			{ rscChunk }
		)
	);

	let lastAbortController: AbortController | undefined;
	const updateDOM = async (url: string | URL, signal: AbortSignal) => {
		const rscUrl = new URL(url);
		rscUrl.searchParams.set("_rsc", "");
		const rscResponse = fetch(rscUrl);
		rscChunk = ReactDOMRSC.createFromFetch(rscResponse);

		if (!signal.aborted) {
			return new Promise<void>((resolve, reject) => {
				signal.addEventListener(
					"abort",
					(error) => {
						reject(error);
					},
					{ once: true }
				);
				let called = false;

				root.render(
					React.createElement(
						// @ts-expect-error
						ReactServerComponent,
						{
							rscChunk,
							done: () => {
								resolve();
								if (called) return;
								called = true;
							},
						}
					)
				);
			});
		}
	};

	const handleNavigate = (event: NavigateEvent) => {
		if (!event.canIntercept || event.hashChange || event.downloadRequest) {
			return;
		}

		const url = new URL(event.destination.url);
		if (url.origin !== location.origin) {
			return;
		}

		// @ts-expect-error
		__oneup.n = {
			state: "loading",
		};
		// @ts-expect-error
		if (__oneup.nc) {
			// @ts-expect-error
			__oneup.nc.forEach((cb) => cb());
		}

		if (lastAbortController) {
			lastAbortController.abort();
		}
		lastAbortController = new AbortController();
		const signal = lastAbortController.signal;

		event.intercept({
			async handler() {
				await updateDOM(url, signal);
				if (!signal.aborted) {
					// @ts-expect-error
					__oneup.n = {
						state: "idle",
					};
					// @ts-expect-error
					if (__oneup.nc) {
						// @ts-expect-error
						__oneup.nc.forEach((cb) => cb());
					}
				}
			},
		});
	};

	if (window.navigation) {
		window.navigation.addEventListener("navigate", handleNavigate);
	}
}
