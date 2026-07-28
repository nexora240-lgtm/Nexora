# Third-Party Licenses

Nexora's own code is licensed under the terms in [LICENSE.txt](LICENSE.txt).
The proxy infrastructure bundled under the `s/` directory incorporates several
independent open-source projects, each under its own license from its
original author(s). Nexora does not claim authorship of these components.
This notice lists them for attribution and compliance purposes.

---

## Ultraviolet (`s/uv/`)

- **Project:** Ultraviolet
- **Author / Org:** TitaniumNetwork ([titaniumnetwork-dev/Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet))
- **License:** GNU Affero General Public License v3.0 (AGPL-3.0)
- **License text:** https://www.gnu.org/licenses/agpl-3.0.html

> **Note on AGPL-3.0 network use:** The AGPL differs from the plain GPL in
> that Section 13 requires that, if you run a modified version of the
> covered work as a network service, you must make the corresponding source
> code of that modified version available to users interacting with it over
> the network. Because Nexora operates Ultraviolet as a live network proxy
> service, this obligation applies. Nexora's own top-level `LICENSE.txt`
> currently covers only GPL-3.0 style terms and does not by itself satisfy
> this AGPL network-source requirement for the bundled Ultraviolet code —
> if any modifications have been made to the vendored Ultraviolet files in
> `s/uv/`, the corresponding modified source should be made available to
> users (e.g., via a public repository link) to remain compliant.

## Scramjet (`s/scram/`)

- **Project:** Scramjet
- **Author / Org:** Mercury Workshop ([MercuryWorkshop/scramjet](https://github.com/MercuryWorkshop/scramjet))
- **Version bundled:** 2.0.0-alpha (build `03d27f5`)
- **License:** No license file is published in the upstream repository at
  the time of writing. Redistribution rights are therefore unclear; the
  site owner should contact Mercury Workshop directly to confirm terms
  before relying on this component long-term, or replace it with a
  clearly-licensed alternative.

## bare-mux (`s/baremux/`)

- **Project:** bare-mux
- **Author / Org:** Mercury Workshop ([MercuryWorkshop/bare-mux](https://github.com/MercuryWorkshop/bare-mux))
- **Version bundled:** v2.1.7 / v2.1.8
- **License:** MIT License

```
MIT License

Copyright (c) Mercury Workshop contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Epoxy (`s/epoxy/`)

- **Project:** epoxy-tls
- **Author / Org:** Mercury Workshop ([MercuryWorkshop/epoxy-tls](https://github.com/MercuryWorkshop/epoxy-tls))
- **License:** No license file is published in the upstream repository at
  the time of writing. As with Scramjet above, redistribution rights are
  unclear; confirm directly with Mercury Workshop before relying on this
  component long-term.

## libcurl.js (`s/libcurl/`)

- **Project:** libcurl.js
- **Author:** ading2210 ([ading2210/libcurl.js](https://github.com/ading2210/libcurl.js))
- **License:** GNU Lesser General Public License v3.0 (LGPL-3.0)
- **License text:** https://www.gnu.org/licenses/lgpl-3.0.html

libcurl.js itself wraps several C libraries, each under its own license
(per the notice embedded in `s/libcurl/index.mjs`):

| Library  | License                                             |
|----------|------------------------------------------------------|
| curl     | curl License (https://curl.se/docs/copyright.html)   |
| mbedtls  | Apache License 2.0                                    |
| cjson    | MIT License                                            |
| zlib     | zlib License                                           |
| brotli   | MIT License                                            |
| nghttp2  | MIT License                                            |

Note that the Wisp server submodule used by libcurl.js's optional server
component is licensed separately under the GNU AGPL v3; Nexora does not
bundle that server component in this repository.

---

## Summary / Action Items for the Site Owner

1. **Ultraviolet is AGPL-3.0**, not GPL-3.0 like Nexora's own `LICENSE.txt`.
   If the vendored `s/uv/` files have been modified from upstream, the
   AGPL's network-source-availability clause (Section 13) likely applies to
   this live proxy service — consider publishing the corresponding source.
2. **Scramjet and epoxy-tls have no clear published license** as of the
   versions bundled here. Verify licensing terms with Mercury Workshop
   directly, or replace these components if terms cannot be confirmed.
3. **bare-mux (MIT) and libcurl.js (LGPL-3.0)** are clearly licensed and
   attributed above; no further action needed beyond keeping this notice
   alongside the code.
