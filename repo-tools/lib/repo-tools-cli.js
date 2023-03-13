import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import arg from "arg";
import * as esbuild from "esbuild";

/**
 * @param {string[]} argv
 */
export async function run(argv) {
	console.log();
	const args = arg(
		{
			"--input": String,
			"--nocheck": Boolean,
			"--output": String,
			"--platform": String,
		},
		{ argv }
	);

	const command = args._[0];

	const pkg = JSON.parse(
		fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
	);

	switch (command) {
		case "build":
			const input = args["--input"];
			const nocheck = args["--nocheck"];
			const output = args["--output"];
			const platform = args["--platform"];
			await Promise.all([
				build({ input, output, pkg, platform }),
				!nocheck ? typecheck({ pkg }) : null,
			]);
			break;
		default:
			throw new Error(`Unknown command: ${command}`);
	}
}

const platforms = new Set(["browser", "node", "neutral"]);
/**
 *
 * @param {{
 * 	input?: string;
 * 	output?: string;
 *  pkg: any;
 * 	platform?: string;
 * }} args
 */
async function build({ input, output, pkg, platform }) {
	if (!platform || !platforms.has(platform)) {
		throw new Error(
			`Invalid platform: Expected one of ${Array.from(platforms).join(
				", "
			)}, instead got ${platform}.`
		);
	}

	const entry = input || "index.ts";

	console.info("⌛️ build", "\t", pkg.name, "\t", entry);
	const report = time();

	const buildResult = await esbuild.build({
		entryPoints: [entry],
		outfile: output || "index.js",
		sourcemap: "external",
		bundle: true,
		format: "esm",
		target: "es2020",
		supported: {
			"top-level-await": true,
		},
		platform: /** @type {esbuild.Platform} */ (platform),
		external: [
			...Object.keys(pkg.dependencies || {}),
			...Object.keys(pkg.optionalDependencies || {}),
			...Object.keys(pkg.optionalPeerDependencies || {}),
		],
	});
	if (buildResult.errors.length > 0) {
		console.error(
			await esbuild.formatMessages(buildResult.errors, {
				kind: "error",
				color: true,
			})
		);
		throw new Error("${pkg.name} build failed.");
	}

	console.info("✅ build", "\t", pkg.name, "\t", report());
}

/**
 *
 * @param {{
 *  pkg: any;
 * }} args
 */
function typecheck({ pkg }) {
	return new Promise((resolve, reject) => {
		console.info("⌛️ tsc", "\t\t", pkg.name);
		const report = time();

		const tsc = cp.spawn("tsc", {
			cwd: process.cwd(),
		});

		tsc.once("close", () => {
			console.info("✅ tsc", "\t\t", pkg.name, "\t", report());
			resolve(undefined);
		});
	});
}

function time() {
	const time = process.hrtime();
	return () => {
		const diff = process.hrtime(time);
		let elapsed = diff[0] * 1e3 + diff[1] / 1e6;
		let label = "ms";
		if (elapsed > 1000) {
			elapsed /= 1000;
			label = "s";
		}

		return `${elapsed.toFixed(2)}${label}`;
	};
}
