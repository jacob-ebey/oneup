import * as React from "react";
import { type RouteProps, InlineScripts } from "oneup/react";
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

				<React.Suspense>
					{/* @ts-expect-error */}
					<Delayed />
				</React.Suspense>
				<script async type="module" src={clientEntry} />
			</body>
		</html>
	);
}

async function Delayed() {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	return <p>Delayed</p>;
}
