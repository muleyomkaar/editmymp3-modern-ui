var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _worker.js
var PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    can_apply: { type: "boolean" },
    summary: { type: "string" },
    message: { type: "string" },
    trim_start: { type: "number", minimum: 0 },
    trim_end: { type: "number", minimum: 0 },
    volume_percent: { type: "integer", minimum: 25, maximum: 200 },
    speed: { type: "number", enum: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    fade_in_seconds: { type: "integer", enum: [0, 1, 2, 3, 5] },
    fade_out_seconds: { type: "integer", enum: [0, 1, 2, 3, 5] },
    normalize: { type: "boolean" },
    reverse: { type: "boolean" }
  },
  required: [
    "can_apply",
    "summary",
    "message",
    "trim_start",
    "trim_end",
    "volume_percent",
    "speed",
    "fade_in_seconds",
    "fade_out_seconds",
    "normalize",
    "reverse"
  ]
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
__name(json, "json");
async function handleAi(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return json({
      error: "Groq is not configured. Add GROQ_API_KEY in Cloudflare \u2192 Workers & Pages \u2192 your project \u2192 Settings \u2192 Variables and Secrets, then redeploy."
    }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const command = typeof body.command === "string" ? body.command.trim() : "";
  const duration = Number(body.duration);
  if (!command || command.length > 500) {
    return json({ error: "Enter an edit instruction up to 500 characters." }, 400);
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 86400) {
    return json({ error: "Invalid audio duration." }, 400);
  }
  const system = `You are the AI edit planner inside a simple MP3 editor.
Translate the user's natural-language request into safe settings for ONE already-loaded MP3.
The audio duration is ${duration.toFixed(3)} seconds.

Supported operations only:
- keep a trim range using trim_start and trim_end
- volume from 25% to 200%, in practical 5% steps
- speed: 0.5, 0.75, 1, 1.25, 1.5, or 2
- fade in/out: 0, 1, 2, 3, or 5 seconds
- normalize on/off
- reverse on/off

Defaults when an operation is not requested:
trim_start=0, trim_end=${duration.toFixed(3)}, volume_percent=100, speed=1, fade_in_seconds=0, fade_out_seconds=0, normalize=false, reverse=false.

Interpret common phrases conservatively:
- "slightly louder" = 110%, "louder" = 120%, "much louder" = 150%
- "slightly faster" = 1.25x, "faster" = 1.5x
- "remove/cut first N seconds" means trim_start=N
- "remove/cut last N seconds" means trim_end=duration-N
- "keep A to B" means that trim range

Never invent capabilities. Noise removal, voice isolation, transcription/content-based cutting, format conversion, EQ, pitch shifting, and merging are NOT handled by this single-file AI editor. If the user asks mainly for an unsupported feature, set can_apply=false, keep all defaults, and explain briefly in message. For merging, tell them to use the separate Merge MP3 tool on the page.

Always keep 0 <= trim_start < trim_end <= duration. Keep fade durations sensible for the selected clip.
summary should be a short plain-English description of the plan. message should be empty when can_apply=true.`;
  let groqResponse;
  try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: system },
          { role: "user", content: command }
        ],
        temperature: 0.1,
        max_completion_tokens: 700,
        include_reasoning: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "mp3_edit_plan",
            strict: true,
            schema: PLAN_SCHEMA
          }
        }
      })
    });
  } catch (error) {
    console.error("Could not reach Groq:", error);
    return json({ error: "The server could not reach Groq. Try again in a moment." }, 502);
  }
  const payload = await groqResponse.json().catch(() => ({}));
  if (!groqResponse.ok) {
    console.error("Groq API error", groqResponse.status, payload);
    if (groqResponse.status === 401) {
      return json({ error: "Groq rejected the API key. Check GROQ_API_KEY in Cloudflare." }, 502);
    }
    if (groqResponse.status === 429) {
      return json({ error: "Groq free-tier rate limit reached. Try again shortly." }, 429);
    }
    return json({
      error: payload?.error?.message ? `Groq error: ${payload.error.message}` : "AI planning is temporarily unavailable."
    }, 502);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return json({ error: "AI returned an empty plan. Try a simpler instruction." }, 502);
  }
  try {
    return json({ plan: JSON.parse(content) });
  } catch {
    console.error("Invalid AI JSON:", content);
    return json({ error: "AI returned an invalid plan. Please try again." }, 502);
  }
}
__name(handleAi, "handleAi");
function seoText(body, contentType) {
  return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" } });
}
__name(seoText, "seoText");
function buildSitemap(origin) {
  const paths = ["/", "/mp3-cutter/", "/merge-mp3/", "/mp3-volume-booster/", "/audio-speed-changer/", "/mp3-converter/", "/about.html", "/privacy.html", "/terms.html"];
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n${urls}\\n</urlset>`;
}
__name(buildSitemap, "buildSitemap");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ai") {
      return handleAi(request, env);
    }
    if (url.pathname === "/sitemap.xml") {
      return seoText(buildSitemap(url.origin), "application/xml; charset=utf-8");
    }
    if (url.pathname === "/robots.txt") {
      return seoText(`User-agent: *
Allow: /

Sitemap: ${url.origin}/sitemap.xml
`, "text/plain; charset=utf-8");
    }
    if (url.pathname === "/mp3-to-wav" || url.pathname === "/mp3-to-wav/") {
      return Response.redirect(`${url.origin}/mp3-converter/`, 301);
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-8iVc7G/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-8iVc7G/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=bundledWorker-0.5893190324518156.mjs.map
