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

// Emulate CJS __dirname global
const __dirname = path.dirname(nodeURL.fileURLToPath(import.meta.url));

// Create a worker that will be used to render RSC chunks
const rscWorker = await createRSCWorker(
	nodeURL.pathToFileURL(path.resolve(__dirname, "build/rsc.js")).href
);

http.createServer(handler).listen(3000, () => {
	console.log("Listening at http://localhost:3000");
});

/**
 * The HTTP request handler
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handler(req, res) {
	const url = new URL(
		req.url || "/",
		"http://" + (req.headers.host || req.headers.referer)
	);

	// Try to serve static files
	if (serveStaticFiles(url, res)) {
		return;
	}

	// Render the RSC chunks in the worker thread
	const rscWorkerStream = rscWorker.render(url.href);

	// If the request is for the RSC chunk, return it
	if (url.searchParams.has("_rsc")) {
		res.writeHead(200, { "Content-Type": "text/x-component" });
		rscWorkerStream.pipe(res, { end: true });
		return;
	}

	// Create the RSC chunk from the worker stream
	const rscChunk = ReactRSC.createFromNodeStream(rscWorkerStream, manifest);
	// Create a transform stream that inlines scripts containing the RSC chunks
	// used for initial hydration to avoid an extra roundtrip to the server
	const rscTransform = new RSCTransform(rscWorkerStream);

	const isBot = isbot(req.headers["user-agent"] || "");
	let didError = false;
	const ssrStream = ReactServer.renderToPipeableStream(
		React.createElement(ReactServerComponent, { rscChunk }),
		{
			// If the request is from a bot, wait for everything to be ready
			onAllReady() {
				if (isBot) {
					res.writeHead(didError ? 500 : 200, {
						"Content-Type": "text/html",
					});
					// Pipe the RSC transform stream to the response
					rscTransform.pipe(res, { end: true });
					// Pipe the SSR stream to the RSC transform stream
					ssrStream.pipe(rscTransform);
				}
			},
			// If the request is from a browser, wait for the shell to be ready
			onShellReady() {
				if (!isBot) {
					res.writeHead(didError ? 500 : 200, {
						"Content-Type": "text/html",
					});
					// Pipe the RSC transform stream to the response
					rscTransform.pipe(res, { end: true });
					// Pipe the SSR stream to the RSC transform stream
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
}

/**
 * A React component that renders a RSC chunk
 * @param {{ rscChunk: any }} props
 */
function ReactServerComponent({ rscChunk }) {
	return React.use(rscChunk);
}

/**
 * Serve static files.
 * @param {URL} url
 * @param {http.ServerResponse} res
 * @returns {boolean}
 */
function serveStaticFiles(url, res) {
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
			return true;
		}
	}
	return false;
}
