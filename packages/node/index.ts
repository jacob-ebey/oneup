import { createRequire } from "node:module";
import { type Writable, PassThrough, Readable, Transform } from "node:stream";
import { Worker } from "node:worker_threads";

import { createId } from "@paralleldrive/cuid2";

const require = createRequire(import.meta.url);

export async function createRSCWorker(buildPath: string) {
	const rscWorker = require.resolve("oneup-node/rsc-worker");
	const worker = new Worker(rscWorker, {
		execArgv: ["--conditions", "react-server"],
		workerData: {
			buildPath,
		},
	});

	await new Promise<void>((resolve, reject) =>
		worker.once("message", (event) => {
			if (event === "ready") {
				resolve();
			} else {
				reject(new Error("rsc worker failed to start"));
			}
		})
	);
	const responses = new Map<string, Writable>();
	worker.on("message", (msg) => {
		const { id, type, payload } = JSON.parse(msg);
		const res = responses.get(id);
		switch (type) {
			case "data":
				res.write(payload);
				break;
			case "end":
				res.end();
				responses.delete(id);
				break;
		}
	});
	worker.once("exit", (code) => {
		console.log("RSC worker exited with code", code);
		process.exit(code);
	});

	return {
		render(url: string | URL) {
			const id = createId();

			const writeable = new PassThrough();
			responses.set(id, writeable);
			worker.postMessage(
				JSON.stringify({
					id,
					type: "render",
					payload: {
						url: url.toString(),
					},
				})
			);

			return writeable;
		},
	};
}

export class RSCTransform extends Transform {
	private rscChunks: string[];
	constructor(rscStream: Readable) {
		super();

		this.rscChunks = [];
		rscStream.on("data", (chunk) => {
			const rscData = chunk.toString();
			this.rscChunks.push(
				`<script>__oneup.c.enqueue(__oneup.e.encode(${JSON.stringify(
					rscData
				)}));</script>`
			);
		});
	}

	// @ts-ignore
	_transform(chunk, encoding, callback) {
		callback(null, chunk);
		for (const rscChunk of this.rscChunks) {
			this.push(rscChunk, "utf8");
		}
		this.rscChunks = [];
	}
}
