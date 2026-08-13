const PLAN_SCHEMA = {
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
    "can_apply", "summary", "message", "trim_start", "trim_end",
    "volume_percent", "speed", "fade_in_seconds", "fade_out_seconds",
    "normalize", "reverse"
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

async function handleAi(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return json({
      error: "Groq is not configured. Add GROQ_API_KEY in Cloudflare → Workers & Pages → your project → Settings → Variables and Secrets, then redeploy."
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
      error: payload?.error?.message
        ? `Groq error: ${payload.error.message}`
        : "AI planning is temporarily unavailable."
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



function seoText(body, contentType) {
  return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" } });
}

function buildSitemap(origin) {
  const paths = ["/", "/mp3-cutter/", "/merge-mp3/", "/mp3-volume-booster/", "/audio-speed-changer/", "/mp3-converter/", "/about.html", "/privacy.html", "/terms.html"];
  const urls = paths.map(path => `  <url><loc>${origin}${path}</loc></url>`).join("\\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n${urls}\\n</urlset>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai") {
      return handleAi(request, env);
    }
    if (url.pathname === "/sitemap.xml") {
      return seoText(buildSitemap(url.origin), "application/xml; charset=utf-8");
    }
    if (url.pathname === "/robots.txt") {
      return seoText(`User-agent: *\nAllow: /\n\nSitemap: ${url.origin}/sitemap.xml\n`, "text/plain; charset=utf-8");
    }
    if (url.pathname === "/mp3-to-wav" || url.pathname === "/mp3-to-wav/") {
      return Response.redirect(`${url.origin}/mp3-converter/`, 301);
    }

    return env.ASSETS.fetch(request);
  }
};
