#!/usr/bin/env node

import("../lib/repo-tools-cli.js")
	.then((mod) => mod.run(process.argv.slice(2)))
	.catch((reason) => {
		console.error(reason.message);
		process.exit(1);
	});
