import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { getInitialRSCFetch } from "oneup-react";
// @ts-expect-error
import { createFromFetch } from "react-server-dom-webpack/client";

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

let rscChunk = createFromFetch(getInitialRSCFetch());
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
	rscChunk = createFromFetch(rscResponse);

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
