import * as React from "react";
import { type RouteProps, InlineScripts } from "oneup-react";
import { ErrorBoundary } from "oneup-react/client";
import clientEntry from "oneup/entry.browser";

import { Counter } from "./components/counter";
import { GlobalLoadingIndicator } from "./components/global-loading-indicator";

export function Component({ outlet }: RouteProps) {
	return (
		<html>
			<head>
				<title>My App</title>
				<link rel="icon" type="image/png" href="/favicon.png" />
				<InlineScripts />
			</head>
			<body>
				<GlobalLoadingIndicator />
				<h1>Hello World</h1>
				<Counter />
				{outlet}

				<ErrorBoundary
					fallback={<p style={{ color: "red" }}>Something went wrong</p>}
				>
					<React.Suspense>
						{/* @ts-expect-error */}
						<Delayed />
					</React.Suspense>
				</ErrorBoundary>
				<script async type="module" src={clientEntry} />
			</body>
		</html>
	);
}

async function Delayed() {
	if (Math.random() >= 0.5) {
		await new Promise((resolve) => setTimeout(resolve, 1000));
	} else {
		await new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Ooops")), 1000)
		);
	}
	return <p>Delayed</p>;
}
