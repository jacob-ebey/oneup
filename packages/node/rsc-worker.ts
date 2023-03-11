import { PassThrough } from "node:stream";
import { parentPort, workerData } from "node:worker_threads";

import * as React from "react";
import RSDWServer from "react-server-dom-webpack/server";
import { createTrie } from "router-trie";

import { Router } from "@oneup/react";

const { renderToPipeableStream } = RSDWServer;

const { routes, manifest } = await import(workerData.buildPath);

const trie = createTrie(routes);

parentPort.addListener("message", handleMessage);
parentPort.postMessage("ready");

function handleMessage(msg) {
	const event = JSON.parse(msg);
	const { id, type, payload } = event;

	const url = new URL(payload.url);

	const passthrough = new PassThrough({
		transform(chunk, _, callback) {
			parentPort.postMessage(
				JSON.stringify({
					id,
					type: "data",
					payload: chunk.toString(),
				})
			);
			callback(null, chunk);
		},
		destroy(error, callback) {
			if (error) {
				parentPort.postMessage(
					JSON.stringify({
						id,
						type: "error",
					})
				);
			}
			callback(error);
		},
		final(callback) {
			parentPort.postMessage(
				JSON.stringify({
					id,
					type: "end",
				})
			);
			callback();
		},
	});
	renderToPipeableStream(
		React.createElement(Router, {
			trie,
			url,
		}),
		manifest
	).pipe(passthrough);
}
