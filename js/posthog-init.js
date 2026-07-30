/* ───────────────────────────────────────────────────────────
 * Nexora — PostHog product analytics + session replay
 * Loaded in the <head> of every page. The snippet below installs a
 * lightweight stub on window.posthog immediately so calls made before
 * the full library finishes loading are queued, then it async-loads
 * array.js from the PostHog CDN.
 *
 * The project API key here is a *public* client-side key — it is safe to
 * embed in the page and only permits sending events, not reading data.
 * ─────────────────────────────────────────────────────────── */
(function () {
  // Official PostHog loader snippet (array.js)
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
      function g(t, e) {
        var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]);
        t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
      }
      (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0,
      p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js",
      (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
      var u = e;
      for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [],
        u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e; },
        u.people.toString = function () { return u.toString(1) + ".people (stub)"; },
        o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "), n = 0; n < o.length; n++) g(u, o[n]);
      e._i.push([i, s, a]);
    }, e.__SV = 1);
  }(document, window.posthog || []);

  posthog.init("phc_sepXibiu9m52NAxvBtEAWLtKnhQ5y7s4mGydyfuZsQPK", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    // Session replay is enabled here; sensitive fields are masked by default.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true, email: true },
    },
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
  });
})();
