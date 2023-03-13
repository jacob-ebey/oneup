"use client";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
// @ts-expect-error
import ReactDOMRSC from "react-server-dom-webpack/client";

declare global {
	interface Window {
		__webpack_require__: (id: string) => Promise<unknown>;
		__webpack_chunk_load__: (id: string) => Promise<unknown>;
		__oneup: {
			navigation: Navigation;
			navigationCallbacks: Set<() => void>;
			rscResponse: Response;
		};
	}
}

// Polyfill the webpack runtime to work for dynamic imports.
if (typeof window !== "undefined") {
	const webpackCache = new Map();

	window.__webpack_require__ = window.__webpack_chunk_load__ =
		window.__webpack_require__ ||
		((id: string) => {
			let p = webpackCache.get(id);
			if (p) return p;
			p = import(id);
			p = p.then(
				(v: unknown) => (p.value = v),
				(r: unknown) => {
					p.reason = r;
					throw r;
				}
			);
			webpackCache.set(id, p);
			return p;
		});
}

/**
 * A component to render RSC chunks retrieved from the server.
 */
function ReactServerComponent({
	done,
	rscChunk,
}: {
	done?: () => void;
	rscChunk: any;
}) {
	// Fire an effect when the chunk is rendred to notify the router
	// when things are done.
	React.useEffect(() => {
		if (done) done();
	}, [done]);
	return React.use(rscChunk);
}

/**
 * Hydrate the document from the initial RSC chunks.
 */
export function hydrateDocument() {
	// Get the initial RSC response from the SSR'd document.
	let rscChunk = ReactDOMRSC.createFromFetch(
		Promise.resolve(window.__oneup.rscResponse)
	);

	// Hydrate the document.
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
		// Make a fetch to the server to get the RSC chunks.
		const rscUrl = new URL(url);
		rscUrl.searchParams.set("_rsc", "");
		const rscResponse = fetch(rscUrl);
		rscChunk = ReactDOMRSC.createFromFetch(rscResponse);

		// Render the RSC chunks and wait for completion or something to suspend.
		return new Promise<void>((resolve) => {
			let called = false;
			signal.addEventListener(
				"abort",
				() => {
					if (called) return;
					called = true;
					resolve();
				},
				{ once: true }
			);

			root.render(
				React.createElement(
					// @ts-expect-error
					ReactServerComponent,
					{
						rscChunk,
						done: () => {
							if (called) return;
							called = true;
							resolve();
						},
					}
				)
			);
		});
	};

	const handleNavigate = (
		// @ts-expect-error
		event: NavigateEvent
	) => {
		if (!event.canIntercept || event.hashChange || event.downloadRequest) {
			return;
		}

		// Check if the URL is on the same origin.
		const url = new URL(event.destination.url);
		if (url.origin !== location.origin) {
			return;
		}

		// Put the app into a loading state.
		window.__oneup.navigation = {
			state: "loading",
		};
		// Notify any listeners that the navigation state has changed.
		if (window.__oneup.navigationCallbacks) {
			window.__oneup.navigationCallbacks.forEach((cb) => cb());
		}

		// Abort the last navigation if it's still in progress.
		if (lastAbortController) {
			lastAbortController.abort();
		}

		// Start a new navigation.
		lastAbortController = new AbortController();
		const signal = lastAbortController.signal;

		// Intercept the navigation and update the DOM.
		event.intercept({
			async handler() {
				await updateDOM(url, signal);
				if (!signal.aborted) {
					// Put the app back into an idle state.
					window.__oneup.navigation = {
						state: "idle",
					};
					// Notify any listeners that the navigation state has changed.
					if (window.__oneup.navigationCallbacks) {
						window.__oneup.navigationCallbacks.forEach((cb) => cb());
					}
				}
			},
		});
	};

	// @ts-expect-error
	if (window.navigation) {
		// @ts-expect-error
		window.navigation.addEventListener("navigate", handleNavigate);
	}
}

export type Navigation =
	| {
			state: "idle";
	  }
	| {
			state: "loading";
	  };

const IDLE = { state: "idle" } satisfies Navigation;

/**
 * A hook to get the current navigation state.
 */
export function useNavigation() {
	return React.useSyncExternalStore<Navigation>(
		(onStoreChange) => {
			const callbacks = (window.__oneup.navigationCallbacks =
				window.__oneup.navigationCallbacks || new Set());
			const cb = () => {
				onStoreChange();
			};
			callbacks.add(cb);
			return () => {
				callbacks.delete(cb);
			};
		},
		() => {
			if (!window.__oneup.navigation) {
				return IDLE;
			}
			return window.__oneup.navigation;
		},
		() => IDLE
	);
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback: React.ReactNode;
}

/**
 * An error boundary that can be used to render a fallback when an error occurs.
 */
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
		if (window.__oneup.navigation.state === "idle" && this.state.error) {
			this.setState({ error: null });
		}
	}

	componentDidMount() {
		const callbacks = (window.__oneup.navigationCallbacks =
			window.__oneup.navigationCallbacks || new Set());
		callbacks.add(this.onNavigationStateChanged);
	}

	componentWillUnmount(): void {
		window.__oneup.navigationCallbacks.delete(this.onNavigationStateChanged);
	}

	render() {
		if (this.state.error) {
			return this.props.fallback;
		}

		return this.props.children;
	}
}
