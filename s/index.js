/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("uv-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("uv-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("uv-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("uv-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("uv-error-code");

let _scramjet = null;

async function initScramjet() {
	const { ScramjetController } = $scramjetLoadController();
	_scramjet = new ScramjetController({
		prefix: "/scramjet/",
		files: {
			wasm: "/scram/scramjet.wasm.wasm",
			all: "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		}
	});
	await _scramjet.init();

	const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
	try {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: "wss://anura.pro/" }]);
	} catch (e) {
		await connection.setTransport("/baremux/index.mjs", ["https://aluu.xyz/bare/"]);
	}

	await navigator.serviceWorker.register("/sw.js");
	await navigator.serviceWorker.ready;
}

form.addEventListener("submit", async (event) => {
	event.preventDefault();

	try {
		await initScramjet();
	} catch (err) {
		error.textContent = "Failed to initialize proxy.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const url = search(address.value, searchEngine.value);
	location.href = _scramjet.encodeUrl(url);
});