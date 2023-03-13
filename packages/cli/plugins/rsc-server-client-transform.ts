import * as sucrase from "sucrase";
import * as babel from "@babel/core";

import type * as Plugin from "../plugin";

const t = babel.types;
const loaders = new Set(["js", "jsx", "ts", "tsx"]);

export function createRscServerClientTransformPlugin(
	isProduction: boolean,
	clientModules: Map<string, Set<string>>
): Plugin.TransformPlugin {
	let componentCounter = 0;
	return async (contents) => {
		if (!loaders.has(contents.loader)) {
			return contents;
		}

		const transforms: sucrase.Transform[] = [];
		if (contents.loader === "jsx") {
			transforms.push("jsx");
		} else if (contents.loader === "tsx") {
			transforms.push("jsx");
			transforms.push("typescript");
		} else if (contents.loader === "ts") {
			transforms.push("typescript");
		}

		const { code, sourceMap } = sucrase.transform(contents.code, {
			transforms,
			filePath: contents.path,
			jsxRuntime: "automatic",
			production: true,
			preserveDynamicImport: true,
			disableESTransforms: true,
		});

		let isClientModule = false;
		let exportsCache = new Set<string>();
		let transformedClasses = new Set<string>();
		const transformResult = babel.transformSync(code, {
			babelrc: false,
			configFile: false,
			filename: contents.path,
			plugins: [
				{
					pre(file) {
						isClientModule =
							file.ast.program.directives.some((node) => {
								if (node.value.value === "use client") {
									const cache =
										clientModules.get(contents.path) || exportsCache;
									clientModules.set(contents.path, cache);
									return true;
								}
							}) ||
							file.ast.program.body.some((node) => {
								// find "use client" or 'use client' or `use client` in the top level
								if (
									t.isExpressionStatement(node) &&
									t.isStringLiteral(node.expression)
								) {
									if (node.expression.value === "use client") {
										const cache =
											clientModules.get(contents.path) || exportsCache;
										clientModules.set(contents.path, cache);
										return true;
									}
								}
							});
					},
					visitor: {
						ExportNamedDeclaration(path) {
							if (!isClientModule) {
								path.stop();
								return;
							}
							let name;
							if (
								(t.isFunctionDeclaration(path.node.declaration) ||
									t.isClassDeclaration(path.node.declaration)) &&
								(name = isReactComponent(path.node.declaration.id?.name))
							) {
								exportsCache.add(name);
								const declaration = path.get(
									"declaration"
								) as babel.NodePath<babel.types.FunctionDeclaration>;
								path
									.get("declaration")
									.replaceWith(
										t.functionDeclaration(
											declaration.node.id,
											[],
											t.blockStatement([])
										)
									);

								path.skip();
							}

							for (const specifier of path.node.specifiers) {
								if (
									t.isExportSpecifier(specifier) &&
									transformedClasses.has(specifier.local.name)
								) {
									exportsCache.add(specifier.local.name);
								}
							}
						},
						ClassDeclaration(path) {
							let name;
							if ((name = isReactComponent(path.node.id.name))) {
								transformedClasses.add(name);
								path.replaceWith(
									t.functionDeclaration(path.node.id, [], t.blockStatement([]))
								);
							}
						},
						Class(path) {
							if (path.node.id) {
								return;
							}
							if (path.parent.type !== "VariableDeclarator") {
								return;
							}
							if (path.parent.id.type !== "Identifier") {
								return;
							}
							let name: string | undefined = path.parent.id.name;
							if ((name = isReactComponent(name))) {
								transformedClasses.add(name);
								path.replaceWith(t.objectExpression([]));
							}
						},
					},
				},
			],
		});

		if (!isClientModule) {
			return contents;
		}

		let transformedCode = transformResult?.code || "";
		for (const rscExport of exportsCache) {
			transformedCode += `
Object.defineProperties(${rscExport}, {
  $$typeof: { value: Symbol.for("react.client.reference") },
	$$id: { value: ${JSON.stringify(`client-component-${componentCounter++}`)} },
});
`;
		}

		return {
			code: transformedCode,
			loader: "js",
			path: contents.path,
		};
	};
}

function isReactComponent(name?: string): string | undefined {
	return name && name[0] === name[0].toUpperCase() ? name : undefined;
}
