(function () {
  function firstText(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";

    const record = value;
    const content = record.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((part) => part && typeof part === "object" && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
    }

    const message = record.message;
    if (message && typeof message === "object") return firstText(message);
    const payload = record.payload;
    if (payload && typeof payload === "object") return firstText(payload);
    return "";
  }

  function eventFromValue(value, eventName = "") {
    if (value === "[DONE]") return { kind: "done" };
    if (!value || typeof value !== "object") return null;

    const record = value;
    const type = String(record.type ?? record.event ?? record.state ?? eventName).toLowerCase();
    const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
    const explicitDelta = record.delta ?? record.chunk ?? record.token ?? payload.delta ?? payload.chunk ?? payload.token;
    const delta = firstText(explicitDelta)
      || (typeof record.text === "string" && /delta|partial|token|chunk/.test(type) ? record.text : "")
      || (/delta|partial|token|chunk/.test(type) ? firstText(record.message ?? payload.message ?? payload) : "");
    if (delta) return { kind: "delta", text: delta };

    const choiceDelta = record.choices?.[0]?.delta?.content;
    if (typeof choiceDelta === "string" && choiceDelta) return { kind: "delta", text: choiceDelta };

    const reply = typeof record.reply === "string"
      ? record.reply
      : firstText(record.final ?? record.result ?? (/final|complete|end/.test(type) ? record.message ?? payload.message ?? payload : null));
    if (reply) return { kind: "final", text: reply };
    if (/error|fail/.test(type)) return { kind: "error", message: String(record.message ?? "Assistant stream failed") };
    if (/done|final|complete|end/.test(type)) return { kind: "done" };
    return null;
  }

  function parseSseBlock(block) {
    let eventName = "";
    const data = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return null;
    const raw = data.join("\n");
    try {
      return eventFromValue(JSON.parse(raw), eventName);
    } catch {
      return eventFromValue(raw, eventName);
    }
  }

  function createLineDecoder(parseLine) {
    let buffer = "";
    return {
      push(chunk) {
        buffer += chunk.replace(/\r\n/g, "\n");
        const values = [];
        let lineEnd;
        while ((lineEnd = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          if (!line) continue;
          const event = parseLine(line);
          if (event) values.push(event);
        }
        return values;
      },
      finish() {
        const line = buffer.trim();
        buffer = "";
        return line ? [parseLine(line)].filter(Boolean) : [];
      },
    };
  }

  function createSseDecoder() {
    let buffer = "";
    return {
      push(chunk) {
        buffer += chunk.replace(/\r\n/g, "\n");
        const values = [];
        let blockEnd;
        while ((blockEnd = buffer.indexOf("\n\n")) >= 0) {
          const event = parseSseBlock(buffer.slice(0, blockEnd));
          buffer = buffer.slice(blockEnd + 2);
          if (event) values.push(event);
        }
        return values;
      },
      finish() {
        const event = parseSseBlock(buffer);
        buffer = "";
        return event ? [event] : [];
      },
    };
  }

  /**
   * OpenClaw may emit either a token delta or a cumulative `partial` message.
   * The BE intentionally forwards it verbatim, so normalize it at the UI edge:
   * a newer cumulative value replaces the visible value; an actual delta appends.
   */
  function mergeStreamText(current, incoming) {
    if (!incoming) return current;
    if (!current) return incoming;
    if (incoming.startsWith(current)) return incoming;
    // A delayed cumulative chunk must not make the displayed reply move backwards.
    if (current.startsWith(incoming)) return current;
    return current + incoming;
  }

  async function readChatStream(response, onEvent = () => {}) {
    const contentType = response.headers?.get?.("content-type") ?? "";
    const isSse = /text\/event-stream/i.test(contentType);
    const isNdjson = /(?:x-)?ndjson/i.test(contentType);
    if (!isSse && !isNdjson) {
      const body = await response.json();
      if (!response.ok) throw new Error(String(body.message ?? body.error ?? "Chat request failed"));
      return { reply: typeof body.reply === "string" ? body.reply : "", streamed: false };
    }
    if (!response.ok) throw new Error(`Chat request failed (${response.status})`);
    if (!response.body) throw new Error("Chat stream body is unavailable");

    const decoder = isSse
      ? createSseDecoder()
      : createLineDecoder((line) => {
          try {
            return eventFromValue(JSON.parse(line));
          } catch {
            return null;
          }
        });
    const reader = response.body.getReader();
    const textDecoder = new TextDecoder();
    let reply = "";
    let streamed = false;

    function apply(events) {
      for (const event of events) {
        if (event.kind === "error") throw new Error(event.message);
        if (event.kind === "delta") {
          streamed = true;
          reply += event.text;
          onEvent(event);
        }
        if (event.kind === "final") {
          streamed = true;
          reply = event.text;
          onEvent(event);
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      apply(decoder.push(textDecoder.decode(value, { stream: true })));
    }
    apply(decoder.push(textDecoder.decode()));
    apply(decoder.finish());
    return { reply, streamed };
  }

  const api = { eventFromValue, createSseDecoder, createLineDecoder, mergeStreamText, readChatStream };
  globalThis.BuildMateChatStream = api;
  if (typeof module !== "undefined") module.exports = api;
})();
