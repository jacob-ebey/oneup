// This file is used to configure the OneUp app. It defines the routing
// structure and is the entrypoint for the RSC bundle.

import type { RouteConfig } from "oneup-react";

import * as root from "./root";
import * as index from "./routes/_index";
import * as about from "./routes/about";

export const routes = [
	{
		id: "root",
		...root,
		children: [
			{
				id: "index",
				index: true,
				...index,
			},
			{
				id: "about",
				path: "about",
				...about,
			},
		],
	},
] satisfies RouteConfig[];
