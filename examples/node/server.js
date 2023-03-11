import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as url from "node:url";

import * as React from "react";
import * as ReactServer from "react-dom/server";
// @ts-expect-error
import * as ReactRSC from "react-server-dom-webpack/client";
import { createRSCWorker, RSCTransform } from "oneup/node";
import * as compress from "compressing";

import { manifest } from "./build/server-client.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const rscWorker = await createRSCWorker(
	path.resolve(__dirname, "build/rsc.js")
);

/**
 * @param {{ rscChunk: any }} props
 */
function ReactServerComponent({ rscChunk }) {
	return React.use(rscChunk);
}

http
	.createServer((req, res) => {
		if (req.url?.endsWith(".js")) {
			const staticFile = path.resolve(
				process.cwd(),
				"public",
				req.url.slice(1)
			);
			if (fs.existsSync(staticFile)) {
				const fileStream = new compress.gzip.FileStream({
					source: staticFile,
				});
				res.writeHead(200, {
					"Content-Type": "application/javascript",
					"Content-Encoding": "gzip",
				});
				fileStream.pipe(res, { end: true });
				return;
			}
		} else if (req.url === "/favicon.png") {
			const staticFile = path.resolve(
				process.cwd(),
				"public",
				req.url.slice(1)
			);
			if (fs.existsSync(staticFile)) {
				const fileStream = new compress.gzip.FileStream({
					source: staticFile,
				});
				res.writeHead(200, {
					"Content-Type": "image/png",
					"Content-Encoding": "gzip",
				});
				fileStream.pipe(res, { end: true });
				return;
			}
		}

		const rscStream = rscWorker.render("http://localhost:3000" + req.url);

		const { search } = url.parse(req.url || "/", true);
		const searchParams = new URLSearchParams(search || "");
		if (searchParams.has("_rsc")) {
			res.writeHead(200, { "Content-Type": "application/javascript" });
			rscStream.pipe(res, { end: true });
			return;
		}

		const rscChunk = ReactRSC.createFromNodeStream(rscStream, manifest);
		const rscTransform = new RSCTransform(rscStream);

		rscTransform.pipe(res, { end: true });

		ReactServer.renderToPipeableStream(
			React.createElement(ReactServerComponent, { rscChunk })
		).pipe(rscTransform);
	})
	.listen(3000, () => {
		console.log("Listening at http://localhost:3000");
	});
