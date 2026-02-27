const DEFAULT_TARGET_ORIGIN = "https://uv-proxyservice.fly.dev";

function normalizeOrigin(origin) {
	if (!origin) return DEFAULT_TARGET_ORIGIN;
	try {
		const url = new URL(origin);
		url.pathname = url.pathname.replace(/\/+$/, "");
		url.search = "";
		url.hash = "";
		return url.toString();
	} catch {
		return DEFAULT_TARGET_ORIGIN;
	}
}

function isHeaderAllowed(name) {
	// Remove hop-by-hop headers per RFC 7230.
	return ![
		"connection",
		"keep-alive",
		"proxy-authenticate",
		"proxy-authorization",
		"te",
		"trailer",
		"transfer-encoding",
		"upgrade",
	].includes(name.toLowerCase());
}

function corsHeaders(origin) {
	// Ultraviolet runs as a SW and needs CORS for the bare endpoint.
	return {
		"access-control-allow-origin": origin || "*",
		"access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
		"access-control-allow-headers": "*",
		"access-control-expose-headers": "*",
		"access-control-max-age": "600",
	};
}

export const handler = async (event) => {
	const targetOrigin = normalizeOrigin(process.env.TARGET_ORIGIN);
	const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
	const rawPath = event?.rawPath ?? event?.path ?? "/";
	const rawQueryString = event?.rawQueryString
		? `?${event.rawQueryString}`
		: "";

	// Quick CORS preflight.
	if (method.toUpperCase() === "OPTIONS") {
		return {
			statusCode: 204,
			headers: {
				...corsHeaders(event?.headers?.origin),
			},
			body: "",
		};
	}

	let upstreamUrl;
	try {
		upstreamUrl = new URL(`${targetOrigin}${rawPath}${rawQueryString}`);
	} catch {
		upstreamUrl = new URL(targetOrigin);
	}

	const incomingHeaders = event?.headers || {};
	const outgoingHeaders = new Headers();
	for (const [name, value] of Object.entries(incomingHeaders)) {
		if (value == null) continue;
		if (!isHeaderAllowed(name)) continue;
		if (name.toLowerCase() === "host") continue;
		outgoingHeaders.set(name, String(value));
	}
	outgoingHeaders.set("host", upstreamUrl.host);

	let body;
	if (event?.body != null && !["GET", "HEAD"].includes(method.toUpperCase())) {
		body = event.isBase64Encoded
			? Buffer.from(event.body, "base64")
			: event.body;
	}

	let upstreamResponse;
	try {
		upstreamResponse = await fetch(upstreamUrl, {
			method,
			headers: outgoingHeaders,
			body,
			redirect: "manual",
		});
	} catch (err) {
		return {
			statusCode: 502,
			headers: {
				...corsHeaders(event?.headers?.origin),
				"content-type": "text/plain; charset=utf-8",
			},
			body: `Upstream fetch failed: ${err?.message || String(err)}`,
		};
	}

	const resHeaders = {};
	const cookies = [];

	// Some environments expose Set-Cookie via getSetCookie().
	if (typeof upstreamResponse.headers.getSetCookie === "function") {
		for (const cookie of upstreamResponse.headers.getSetCookie()) cookies.push(cookie);
	}

	for (const [name, value] of upstreamResponse.headers.entries()) {
		if (!isHeaderAllowed(name)) continue;
		if (name.toLowerCase() === "set-cookie") {
			// If getSetCookie() wasn't available, fall back to single header value.
			if (value) cookies.push(value);
			continue;
		}
		resHeaders[name] = value;
	}

	Object.assign(resHeaders, corsHeaders(event?.headers?.origin));

	const arrayBuffer = await upstreamResponse.arrayBuffer();
	const responseBody = Buffer.from(arrayBuffer).toString("base64");

	const result = {
		statusCode: upstreamResponse.status,
		headers: resHeaders,
		body: responseBody,
		isBase64Encoded: true,
	};

	if (cookies.length) result.cookies = cookies;
	return result;
};
