import * as React from "react";
import {
	type Node,
	type IndexRouteConfig as BaseIndexRouteConfig,
	type NonIndexRouteConfig as BaseNonIndexRouteConfig,
	matchTrie,
} from "router-trie";

export type BaseRouteConfig = {
	Component?: unknown;
};

export type IndexRouteConfig = BaseIndexRouteConfig & BaseRouteConfig;
export type NonIndexRouteConfig = Omit<BaseNonIndexRouteConfig, "children"> &
	BaseRouteConfig & {
		children?: RouteConfig[];
	};

export type RouteConfig = IndexRouteConfig | NonIndexRouteConfig;

export interface RouteProps {
	outlet?: React.ReactNode;
}

/**
 * A simple RSC compatible router. This is utilized by internals
 * and should not be rendered directly in your application code.
 */
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

/**
 * Renders the streaming RSC runtime. This should be rendered in the head of your document.
 */
export function InlineScripts() {
	return React.createElement(
		React.Fragment,
		null,
		React.createElement("script", {
			dangerouslySetInnerHTML: {
				__html: `
var __oneup = { e: new TextEncoder() };
__oneup.rscResponse = new Response(new ReadableStream({ start(c) { __oneup.c = c; } }));
								`.trim(),
			},
		})
	);
}

interface BrowserEntryProps {
	browserEntry: string;
}

/**
 * Renders the nessesary script tags to hydrate your application in the browser.
 */
export function BrowserEntry({ browserEntry }: BrowserEntryProps) {
	const { entry, chunks } = JSON.parse(browserEntry) as {
		entry: string;
		chunks: string[];
	};
	return React.createElement(React.Fragment, {
		children: [
			...chunks.map((chunk) =>
				React.createElement("link", {
					rel: "modulepreload",
					href: chunk,
				})
			),
			React.createElement("script", {
				async: true,
				type: "module",
				src: entry,
			}),
		],
	});
}
