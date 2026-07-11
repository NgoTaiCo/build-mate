import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT ?? 8781);
const contexts = new Map();
const pendingResults = new Map();

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function getContext(contextId) {
  return contexts.get(contextId) ?? null;
}

function enqueue(context, command) {
  if (context.waiting) {
    context.waiting(command);
    context.waiting = null;
    return;
  }
  context.queue.push(command);
}

function nextCommand(context) {
  const queued = context.queue.shift();
  if (queued) return Promise.resolve(queued);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (context.waiting === deliver) context.waiting = null;
      resolve(null);
    }, 25_000);
    const deliver = (command) => {
      clearTimeout(timeout);
      resolve(command);
    };
    context.waiting = deliver;
  });
}

function waitForResult(commandId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingResults.delete(commandId);
      resolve({ command_id: commandId, ok: false, error: "EXTENSION_TIMEOUT" });
    }, 30_000);
    pendingResults.set(commandId, {
      resolve: (result) => {
        clearTimeout(timeout);
        pendingResults.delete(commandId);
        resolve(result);
      },
    });
  });
}

const mockBuildPc = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>BuildMate mock BuildPC</title>
<style>body{font-family:system-ui;margin:2rem;max-width:720px}section{border:1px solid #ccc;padding:1rem;margin:.7rem 0}dialog{border:1px solid #333;padding:1rem}.product{border-top:1px solid #ddd;padding:.8rem 0}button{padding:.45rem .75rem}</style>
</head><body><h1>Mock Phong Vu BuildPC</h1><p id="build-total">Tổng: 0 VND</p>
<section data-build-category="cpu"><strong>CPU</strong><span data-selected-name>Chưa chọn</span><button data-build-action="open-category">Chọn</button><button data-build-action="remove-component">Xóa</button></section>
<section data-build-category="gpu"><strong>VGA</strong><span data-selected-name>Chưa chọn</span><button data-build-action="open-category">Chọn</button><button data-build-action="remove-component">Xóa</button></section>
<dialog data-product-modal><h2 id="modal-title">Chọn linh kiện</h2><div id="products"></div><button data-build-action="close-modal">Đóng</button></dialog>
<script>
const catalog={cpu:[{id:'PV-CPU-001',sku:'CPU-001',name:'AMD Ryzen 5 7600',price:4990000}],gpu:[{id:'PV-GPU-001',sku:'GPU-001',name:'Demo Radeon RX 7800 XT',price:12990000},{id:'PV-GPU-002',sku:'GPU-002',name:'Demo GeForce RTX 4070',price:13990000}]};
let currentCategory=null; const modal=document.querySelector('[data-product-modal]');
document.addEventListener('click',(event)=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.buildAction==='open-category'){const row=button.closest('[data-build-category]');currentCategory=row.dataset.buildCategory;document.querySelector('#modal-title').textContent='Chọn '+currentCategory;document.querySelector('#products').innerHTML=catalog[currentCategory].map(p=>'<article class="product" data-vendor-product-id="'+p.id+'" data-sku="'+p.sku+'"><strong>'+p.name+'</strong><button data-build-action="select-product">Chọn</button></article>').join('');modal.showModal();}if(button.dataset.buildAction==='close-modal')modal.close();if(button.dataset.buildAction==='select-product'){const card=button.closest('[data-vendor-product-id]');const item=catalog[currentCategory].find(p=>p.id===card.dataset.vendorProductId);const row=document.querySelector('[data-build-category="'+currentCategory+'"]');row.dataset.vendorProductId=item.id;row.dataset.sku=item.sku;row.dataset.selectedName=item.name;row.dataset.price=item.price;row.querySelector('[data-selected-name]').textContent=item.name;const total=[...document.querySelectorAll('[data-build-category]')].reduce((sum,r)=>sum+Number(r.dataset.price||0),0);document.querySelector('#build-total').textContent='Tổng: '+total+' VND';modal.close();}if(button.dataset.buildAction==='remove-component'){const row=button.closest('[data-build-category]');delete row.dataset.vendorProductId;delete row.dataset.sku;delete row.dataset.selectedName;delete row.dataset.price;row.querySelector('[data-selected-name]').textContent='Chưa chọn';const total=[...document.querySelectorAll('[data-build-category]')].reduce((sum,r)=>sum+Number(r.dataset.price||0),0);document.querySelector('#build-total').textContent='Tổng: '+total+' VND';}});
</script></body></html>`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && url.pathname === "/mock-buildpc") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(mockBuildPc);
      return;
    }

    if (request.method === "GET" && url.pathname === "/contexts") {
      json(response, 200, {
        contexts: [...contexts.entries()].map(([contextId, context]) => ({
          context_id: contextId,
          page_url: context.pageUrl,
          registered_at: context.registeredAt,
          last_seen_at: context.lastSeenAt,
          queued_commands: context.queue.length,
        })),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/contexts") {
      const payload = await readJson(request);
      if (typeof payload.context_id !== "string" || typeof payload.page_url !== "string") {
        json(response, 400, { error: "context_id and page_url are required" });
        return;
      }
      const current = getContext(payload.context_id) ?? {
        queue: [],
        waiting: null,
        registeredAt: new Date().toISOString(),
        lastSeenAt: null,
      };
      current.pageUrl = payload.page_url;
      contexts.set(payload.context_id, current);
      json(response, 200, { ok: true, context_id: payload.context_id });
      return;
    }

    if (request.method === "GET" && url.pathname === "/commands") {
      const context = getContext(url.searchParams.get("context_id") ?? "");
      if (!context) return json(response, 404, { error: "CONTEXT_NOT_CONNECTED" });
      context.lastSeenAt = new Date().toISOString();
      const command = await nextCommand(context);
      return json(response, 200, { command });
    }

    if (request.method === "POST" && url.pathname === "/dom-commands") {
      const payload = await readJson(request);
      const context = getContext(payload.context_id);
      if (!context) return json(response, 404, { command_id: null, ok: false, error: "CONTEXT_NOT_CONNECTED" });
      if (!["read_build", "add_component", "remove_component"].includes(payload.action)) {
        return json(response, 400, { command_id: null, ok: false, error: "INVALID_ACTION" });
      }
      const commandId = randomUUID();
      enqueue(context, {
        command_id: commandId,
        action: payload.action,
        component: payload.component,
        expected_revision: payload.expected_revision,
      });
      return json(response, 200, await waitForResult(commandId));
    }

    const resultMatch = url.pathname.match(/^\/commands\/([^/]+)\/result$/);
    if (request.method === "POST" && resultMatch) {
      const pending = pendingResults.get(resultMatch[1]);
      if (!pending) return json(response, 404, { error: "UNKNOWN_COMMAND" });
      const payload = await readJson(request);
      pending.resolve({ command_id: resultMatch[1], ...payload });
      return json(response, 200, { ok: true });
    }

    json(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`BuildMate DOM bridge simulator: http://127.0.0.1:${port}/mock-buildpc`);
});
