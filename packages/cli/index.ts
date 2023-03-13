import * as fs from "node:fs";
import * as path from "node:path";

import arg from "arg";
import enhancedResolve from "enhanced-resolve";
import * as esbuild from "esbuild";

import { createESBuildPlugin } from "./plugin";
import { createRscServerClientTransformPlugin } from "./plugins/rsc-server-client-transform";

export async function run(argv: string[]) {
	const args = arg(
		{
			"--cwd": String,
			"--config": String,
			"--help": Boolean,
			"--mode": String,
		},
		{ argv }
	);
	const command = args._[0];
	const help = args["--help"];
	const cwd = args["--cwd"] ? path.resolve(args["--cwd"]) : process.cwd();

	switch (command) {
		case "build":
			if (help) {
				console.log(`
Usage: oneup build [options]

Options:
    --cwd       Working directory. Defaults to the current directory.
    --config    Path to the oneup config file. Defaults to "app/oneup.ts" in the working directory.
		--mode      Build mode. Defaults to "production".
`);
				return;
			}
			await build(cwd, args["--config"], args["--mode"]);
			return;
		default:
			if (help) {
				console.log(`
Usage: oneup [command] [options]

Commands:
    build    Build the application.

Options:
    --cwd    Working directory. Defaults to the current directory.
`);
				return;
			}
			throw new Error(
				command ? `Unknown command: ${command}` : "No command specified"
			);
	}
}

async function build(cwd: string, config?: string, mode?: string) {
	const pkg = JSON.parse(
		fs.readFileSync(path.resolve(cwd, "package.json"), "utf8")
	);

	config = config || "app/oneup.ts";

	const clientModules = new Map<string, Set<string>>();

	const externalsArray = [
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.devDependencies || {}),
		...Object.keys(pkg.optionalDependencies || {}),
	];
	const externalsSet = new Set(externalsArray);

	const isProduction = mode !== "development";

	const externalsPlugin: esbuild.Plugin = {
		name: "externals",
		setup(build) {
			build.onResolve({ filter: /.*/ }, (args) => {
				if (
					externalsSet.has(args.path) ||
					(args.path !== "oneup/entry.browser" &&
						externalsArray.some((external) =>
							args.path.startsWith(external + "/")
						))
				) {
					return {
						path: args.path,
						external: true,
						namespace: "external",
					};
				}
				return undefined;
			});
		},
	};

	const resolver = enhancedResolve.ResolverFactory.createResolver({
		fileSystem: new enhancedResolve.CachedInputFileSystem(fs, 4000),
	});

	const rscBuildResult = await esbuild.build({
		absWorkingDir: cwd,
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node18",
		logLevel: "info",
		write: false,
		outfile: "build/rsc.js",
		minify: isProduction,
		jsxDev: false,
		define: {
			"process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
		},
		entryPoints: [config],
		plugins: [
			createESBuildPlugin({
				transformPlugins: [
					createRscServerClientTransformPlugin(isProduction, clientModules),
				],
			}),
		],
	});
	if (rscBuildResult.errors.length > 0) {
		throw new Error("RSC build failed.");
	}

	const clientEntries = Array.from(clientModules.keys());

	const browserBuildResult = await esbuild.build({
		absWorkingDir: cwd,
		bundle: true,
		format: "esm",
		platform: "browser",
		target: "es2020",
		logLevel: "info",
		splitting: true,
		metafile: true,
		sourcemap: "external",
		outdir: "public/build",
		chunkNames: "[name]-[hash]",
		entryNames: "[name]-[hash]",
		minify: isProduction,
		jsxDev: false,
		mainFields: ["browser", "module", "main"],
		conditions: ["browser", "import", "default"],
		entryPoints: ["app/entry.browser.ts", ...clientEntries],
		define: {
			"process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
		},
	});
	if (browserBuildResult.errors.length > 0) {
		throw new Error("Browser build failed.");
	}

	const clientModuleToBrowserOutputModule = new Map<string, string[]>();
	for (const [outfile, meta] of Object.entries(
		browserBuildResult.metafile.outputs
	)) {
		if (!meta.entryPoint) continue;
		const entry = path.resolve(cwd, meta.entryPoint);
		const clientModule = clientModules.get(entry);
		if (!clientModule) continue;
		const mod =
			"/build/" +
			path.relative(
				path.resolve(cwd, "public/build"),
				path.resolve(cwd, outfile)
			);
		clientModuleToBrowserOutputModule.set(entry, [mod]);
	}

	const rscManifest: any = {};
	let componentCounter = 0;
	clientModules.forEach((rscExports, file) => {
		rscExports.forEach((name) => {
			const id = `client-component-${componentCounter++}`;
			const mod = clientModuleToBrowserOutputModule.get(file);
			if (!mod) throw new Error("Could not find browser output module");

			rscManifest[id] = {
				id: mod[0],
				name,
				mod: mod[0],
				chunks: mod.slice(1),
				async: true,
			};
		});
	});

	let [browserEntry] = Object.entries(browserBuildResult.metafile.outputs).find(
		([_, o]) => o.entryPoint === "app/entry.browser.ts"
	)!;
	browserEntry =
		"/build/" +
		path.relative(
			path.resolve(cwd, "public/build"),
			path.resolve(cwd, browserEntry)
		);

	rscBuildResult.outputFiles.forEach((file) => {
		let toWrite = file.text.replace(
			/\$___oneup___entry___browser___\$/g,
			browserEntry
		);
		if (file.path.endsWith("rsc.js")) {
			console.log("Writing manifest to output");
			toWrite += `
export const manifest = ${JSON.stringify(rscManifest, null, 2)};
`;
		}
		fs.mkdirSync(path.dirname(file.path), { recursive: true });
		fs.writeFileSync(file.path, toWrite, "utf8");
	});

	const serverClientBuildResult = await esbuild.build({
		absWorkingDir: cwd,
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node18",
		logLevel: "info",
		splitting: true,
		metafile: true,
		write: false,
		outdir: "build/client-components",
		minify: isProduction,
		jsxDev: false,
		entryPoints: clientEntries,
		plugins: [externalsPlugin],
		define: {
			"process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
		},
	});
	if (serverClientBuildResult.errors.length > 0) {
		throw new Error("Server build failed.");
	}

	serverClientBuildResult.outputFiles.forEach((file) => {
		let toWrite = file.text.replace(
			/\$___oneup___entry___browser___\$/g,
			browserEntry
		);
		fs.mkdirSync(path.dirname(file.path), { recursive: true });
		fs.writeFileSync(file.path, toWrite, "utf8");
	});

	const clientModuleToOutputModule = new Map<string, string>();
	for (const [outfile, meta] of Object.entries(
		serverClientBuildResult.metafile.outputs
	)) {
		if (!meta.entryPoint) continue;
		const entry = path.resolve(cwd, meta.entryPoint);
		const clientModule = clientModules.get(entry);
		if (!clientModule) continue;
		clientModuleToOutputModule.set(entry, path.resolve(cwd, outfile));
	}

	componentCounter = 0;
	const serverClientManifest: any = {};
	clientModules.forEach((rscExports, file) => {
		const outputModule = clientModuleToOutputModule.get(file);
		const mod = clientModuleToBrowserOutputModule.get(file);
		if (!outputModule || !mod || !mod[0])
			throw new Error("Could not find output module");

		rscExports.forEach((name) => {
			// const id = `client-component-${componentCounter++}`;
			serverClientManifest[mod[0]] = {
				[name]: {
					name,
					specifier: outputModule,
				},
			};
		});
	});

	fs.writeFileSync(
		path.resolve(cwd, "build/server-client.js"),
		`
export const manifest = ${JSON.stringify(serverClientManifest, null, 2)};
	`,
		"utf8"
	);
}
