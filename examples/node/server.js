import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as nodeURL from "node:url";

import * as React from "react";
import * as ReactServer from "react-dom/server";
// @ts-expect-error
import * as ReactRSC from "react-server-dom-webpack/client";
import { createRSCWorker, RSCTransform } from "oneup-node";
import * as compress from "compressing";
import * as mime from "mime-types";
import isbot from "isbot";

import { manifest } from "./build/server-client.js";

isbot.exclude(["chrome-lighthouse"]);

const __dirname = path.dirname(nodeURL.fileURLToPath(import.meta.url));

const rscWorker = await createRSCWorker(
	nodeURL.pathToFileURL(path.resolve(__dirname, "build/rsc.js")).href
);

/**
 * @param {{ rscChunk: any }} props
 */
function ReactServerComponent({ rscChunk }) {
	return React.use(rscChunk);
}

http
	.createServer((req, res) => {
		const url = new URL(
			req.url || "/",
			"http://" + (req.headers.host || req.headers.referer)
		);

		const filePathname = url.pathname.slice(1);
		const staticContentType = filePathname && mime.lookup(filePathname);
		if (filePathname && staticContentType) {
			const staticFile = path.resolve(process.cwd(), "public", filePathname);
			const staticFileStats = fs.statSync(staticFile, {
				throwIfNoEntry: false,
			});
			if (staticFileStats && staticFileStats.isFile()) {
				const fileStream = new compress.gzip.FileStream({
					source: staticFile,
				});
				res.writeHead(200, {
					"Content-Type": staticContentType,
					"Content-Encoding": "gzip",
				});
				fileStream.pipe(res, { end: true });
				return;
			}
		}

		const rscStream = rscWorker.render(url.href);

		if (url.searchParams.has("_rsc")) {
			res.writeHead(200, { "Content-Type": "application/javascript" });
			rscStream.pipe(res, { end: true });
			return;
		}

		const rscChunk = ReactRSC.createFromNodeStream(rscStream, manifest);
		const rscTransform = new RSCTransform(rscStream);

		const isBot = isbot(req.headers["user-agent"] || "");
		let didError = false;
		const ssrStream = ReactServer.renderToPipeableStream(
			React.createElement(ReactServerComponent, { rscChunk }),
			{
				onAllReady() {
					if (isBot) {
						res.writeHead(didError ? 500 : 200, {
							"Content-Type": "text/html",
						});
						rscTransform.pipe(res, { end: true });
						ssrStream.pipe(rscTransform);
					}
				},
				onShellReady() {
					if (!isBot) {
						res.writeHead(didError ? 500 : 200, {
							"Content-Type": "text/html",
						});
						rscTransform.pipe(res, { end: true });
						ssrStream.pipe(rscTransform);
					}
				},
				onShellError() {
					res.statusCode = 500;
					res.setHeader("Content-Type", "text/html");
					res.end(`<h1>Something went wrong</h1>`);
				},
				onError(error) {
					didError = true;
					console.error(error);
				},
			}
		);
		setTimeout(() => {
			ssrStream.abort();
		}, 10_000);
	})
	.listen(3000, () => {
		console.log("Listening at http://localhost:3000");
	});
