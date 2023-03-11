import * as React from "react";
import { type Node, matchTrie } from "router-trie";

import type { RouteConfig } from "oneup";

export interface RouteProps {
	outlet: React.ReactNode;
}

export function Router({ trie, url }: { trie: Node<RouteConfig>; url: URL }) {
	const matches = matchTrie(trie as Node<RouteConfig>, url.pathname) || [];

	let lastElement = null;
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];
		if (match.Component) {
			lastElement = React.createElement(
				match.Component as React.ComponentType<RouteProps>,
				{ outlet: lastElement },
				lastElement
			);
		}
	}

	return lastElement;
}

export function InlineScripts() {
	return React.createElement(
		React.Fragment,
		undefined,
		React.createElement("script", {
			dangerouslySetInnerHTML: {
				__html: `
var __oneup = { e: new TextEncoder() };
__oneup.r = new Response(new ReadableStream({ start(c) { __oneup.c = c; } }));
var __webpack_require__ = (id) => {
	const p = import(id)
	return p.then(v => (p.value = v), r => { p.reason = r; throw r; });
};
								`.trim(),
			},
		})
	);
}

export function getInitialRSCFetch() {
	return Promise.resolve(
		// @ts-expect-error
		__oneup.r
	);
}
