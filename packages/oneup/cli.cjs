#!/usr/bin/env node

import("oneup-cli")
	.then((mod) => mod.run(process.argv.slice(2)))
	.catch((reason) => {
		console.error(reason.message);
		process.exit(1);
	});
