let destination = "";

try {
	destination = new URL(location.hash.slice(1));

	if (!destination.protocol) {
		destination = new URL("https://" + destination.href);
	}
} catch (err) {
	alert(`Bad # string or bad URL. Got error:\n${err}`);
	throw err;
}

(async () => {
	try {
		const { ScramjetController } = $scramjetLoadController();
		const scramjet = new ScramjetController({
			prefix: "/scramjet/",
			files: {
				wasm: "/scram/scramjet.wasm.wasm",
				all: "/scram/scramjet.all.js",
				sync: "/scram/scramjet.sync.js",
			}
		});
		await scramjet.init();

		const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
		try {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: "wss://anura.pro/" }]);
		} catch (e) {
			await connection.setTransport("/baremux/index.mjs", ["https://aluu.xyz/bare/"]);
		}

		await navigator.serviceWorker.register("/sw.js");
		await navigator.serviceWorker.ready;

		window.open(scramjet.encodeUrl(destination.toString()), "_self");
	} catch (err) {
		alert(`Encountered error:\n${err}`);
	}
})();