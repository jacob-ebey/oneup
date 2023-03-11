import * as fs from "node:fs";
import * as path from "node:path";

import type * as esbuild from "esbuild";

export interface TransformContents {
	code: string;
	loader: esbuild.Loader;
	path: string;
}

export type TransformPlugin = (
	contents: TransformContents
) => TransformContents | Promise<TransformContents>;

export type PostProcessPlugin = (
	output: esbuild.OutputFile
) => esbuild.OutputFile;

export function createESBuildPlugin({
	transformPlugins,
}: {
	transformPlugins?: TransformPlugin[];
}): esbuild.Plugin {
	return {
		name: "jbundler",
		setup(build) {
			build.onLoad({ filter: /.*/ }, async (args) => {
				let code: string | undefined = undefined;
				const input = Object.defineProperties({} as TransformContents, {
					code: {
						get() {
							if (code === undefined) {
								code = fs.readFileSync(args.path, "utf8");
							}
							return code;
						},
					},
					loader: {
						value: path.extname(args.path).slice(1),
					},
					path: { value: args.path },
				});
				let contents = input;
				for (const plugin of transformPlugins || []) {
					contents = await plugin(contents);
					if (contents.path !== args.path) {
						throw new Error(
							`Plugin ${plugin.name} changed the path from ${path} to ${contents.path}`
						);
					}
				}

				if (contents === input) {
					return;
				}

				return {
					contents: contents.code,
					loader: contents.loader,
					resolveDir: path.dirname(args.path),
				};
			});
		},
	};
}
