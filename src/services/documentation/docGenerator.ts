import { jsPDF } from 'jspdf';
import { DocThemeMode, OpenApiEndpointItem, OpenApiParsedDoc } from '../../types';

export function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildEndpointCurlExample(
  endpoint: OpenApiEndpointItem,
  baseUrl: string
): string {
  const cleanBase = (baseUrl || 'https://api.example.com').replace(/\/$/, '');
  const path = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
  const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
  const qs =
    queryParams.length > 0
      ? `?${queryParams.map((q) => `${q.name}=${q.example ?? 'value'}`).join('&')}`
      : '';

  const lines = [`curl -X ${endpoint.method} "${cleanBase}${path}${qs}"`];
  if (endpoint.security && endpoint.security.length > 0) {
    lines.push(`  -H "Authorization: Bearer <token>"`);
  }
  if (endpoint.requestBody?.exampleJson) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${endpoint.requestBody.exampleJson.replace(/\n/g, ' ')}'`);
  }
  return lines.join(' \\\n');
}

export function generateMarkdownDocumentation(parsed: OpenApiParsedDoc): string {
  const lines: string[] = [];
  lines.push(`# ${parsed.title} (v${parsed.version})`);
  lines.push('');
  if (parsed.description) {
    lines.push(parsed.description);
    lines.push('');
  }

  if (parsed.servers.length > 0) {
    lines.push('## Servers');
    for (const s of parsed.servers) {
      lines.push(`- \`${s.url}\`${s.description ? ` — ${s.description}` : ''}`);
    }
    lines.push('');
  }

  if (parsed.securitySchemes.length > 0) {
    lines.push('## Authentication Schemes');
    for (const sec of parsed.securitySchemes) {
      lines.push(
        `- **${sec.name}** (\`${sec.type}${sec.scheme ? ` / ${sec.scheme}` : ''}\`)${
          sec.description ? ` — ${sec.description}` : ''
        }`
      );
    }
    lines.push('');
  }

  const baseUrl = parsed.servers[0]?.url || 'https://api.example.com';
  lines.push('## Endpoints');
  lines.push('');

  for (const ep of parsed.endpoints) {
    lines.push(`### \`${ep.method}\` \`${ep.path}\``);
    if (ep.summary) lines.push(`**${ep.summary}**`);
    if (ep.description) lines.push(`\n${ep.description}`);
    lines.push('');

    if (ep.parameters.length > 0) {
      lines.push('#### Parameters');
      lines.push('| Name | In | Required | Type | Description |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const p of ep.parameters) {
        const typeStr = String(p.schema?.type || 'string');
        lines.push(
          `| \`${p.name}\` | ${p.in} | ${p.required ? 'Yes' : 'No'} | ${typeStr} | ${
            (p.description || '').replace(/\|/g, '\\|')
          } |`
        );
      }
      lines.push('');
    }

    if (ep.requestBody?.exampleJson) {
      lines.push('#### Request Body Example');
      lines.push('```json');
      lines.push(ep.requestBody.exampleJson);
      lines.push('```');
      lines.push('');
    }

    lines.push('#### Example Request');
    lines.push('```bash');
    lines.push(buildEndpointCurlExample(ep, baseUrl));
    lines.push('```');
    lines.push('');

    if (ep.responses.length > 0) {
      lines.push('#### Responses');
      for (const r of ep.responses) {
        lines.push(`- **${r.statusCode}**: ${r.description || 'Response'}`);
        if (r.exampleJson) {
          lines.push('```json');
          lines.push(r.exampleJson);
          lines.push('```');
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function generateHtmlDocumentation(
  parsed: OpenApiParsedDoc,
  theme: DocThemeMode = 'dark'
): string {
  const isLight = theme === 'light';
  const bg = isLight ? '#f8fafc' : '#0b0f17';
  const surface = isLight ? '#ffffff' : '#121826';
  const border = isLight ? '#e2e8f0' : '#1e293b';
  const text = isLight ? '#0f172a' : '#e2e8f0';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const baseUrl = parsed.servers[0]?.url || 'https://api.example.com';

  const endpointSections = parsed.endpoints
    .map((ep) => {
      const paramsHtml =
        ep.parameters.length > 0
          ? `<h4>Parameters</h4><table><thead><tr><th>Name</th><th>In</th><th>Required</th><th>Type</th></tr></thead><tbody>${ep.parameters
              .map(
                (p) =>
                  `<tr><td><code>${escapeHtml(p.name)}</code></td><td>${escapeHtml(p.in)}</td><td>${
                    p.required ? 'Yes' : 'No'
                  }</td><td>${escapeHtml(String(p.schema?.type || 'string'))}</td></tr>`
              )
              .join('')}</tbody></table>`
          : '';

      const reqHtml = ep.requestBody?.exampleJson
        ? `<h4>Request Body Example</h4><pre><code>${escapeHtml(ep.requestBody.exampleJson)}</code></pre>`
        : '';

      const respHtml = ep.responses
        .map(
          (r) =>
            `<div class="resp"><strong>${escapeHtml(r.statusCode)}</strong> — ${escapeHtml(
              r.description
            )}${
              r.exampleJson
                ? `<pre><code>${escapeHtml(r.exampleJson)}</code></pre>`
                : ''
            }</div>`
        )
        .join('');

      return `<section class="card" id="${escapeHtml(ep.id)}">
        <div class="ep-head">
          <span class="badge ${escapeHtml(ep.method.toLowerCase())}">${escapeHtml(ep.method)}</span>
          <code class="path">${escapeHtml(ep.path)}</code>
        </div>
        ${ep.summary ? `<h3>${escapeHtml(ep.summary)}</h3>` : ''}
        ${ep.description ? `<p class="muted">${escapeHtml(ep.description)}</p>` : ''}
        ${paramsHtml}
        ${reqHtml}
        <h4>cURL Example</h4>
        <pre><code>${escapeHtml(buildEndpointCurlExample(ep, baseUrl))}</code></pre>
        <h4>Responses</h4>
        ${respHtml}
      </section>`;
    })
    .join('\n');

  const navLinks = parsed.endpoints
    .map(
      (ep) =>
        `<li><a href="#${escapeHtml(ep.id)}"><span class="badge sm ${escapeHtml(
          ep.method.toLowerCase()
        )}">${escapeHtml(ep.method)}</span> ${escapeHtml(ep.path)}</a></li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(parsed.title)} - API Documentation</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: ${bg}; color: ${text}; display: flex; min-height: 100vh; }
  nav { width: 280px; border-right: 1px solid ${border}; padding: 20px; position: sticky; top: 0; height: 100vh; overflow-y: auto; background: ${surface}; box-sizing: border-box; }
  nav h2 { font-size: 14px; margin: 0 0 12px; }
  nav ul { list-style: none; padding: 0; margin: 0; }
  nav li { margin-bottom: 6px; font-size: 12px; }
  nav a { color: ${text}; text-decoration: none; display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px; }
  nav a:hover { background: ${border}; }
  main { flex: 1; padding: 32px; max-width: 920px; }
  .card { background: ${surface}; border: 1px solid ${border}; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .ep-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .path { font-size: 15px; font-weight: 600; }
  .muted { color: ${muted}; }
  .badge { font-family: monospace; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #0284c7; color: #fff; }
  .badge.sm { font-size: 10px; padding: 2px 5px; }
  .badge.post { background: #059669; }
  .badge.put, .badge.patch { background: #d97706; }
  .badge.delete { background: #dc2626; }
  pre { background: ${bg}; border: 1px solid ${border}; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
  th, td { border: 1px solid ${border}; padding: 8px; text-align: left; }
</style>
</head>
<body>
  <nav>
    <h2>${escapeHtml(parsed.title)}</h2>
    <p class="muted" style="font-size:12px;">Version ${escapeHtml(parsed.version)}</p>
    <ul>${navLinks}</ul>
  </nav>
  <main>
    <h1>${escapeHtml(parsed.title)} <small class="muted">v${escapeHtml(parsed.version)}</small></h1>
    ${parsed.description ? `<p class="muted">${escapeHtml(parsed.description)}</p>` : ''}
    ${endpointSections}
  </main>
</body>
</html>`;
}

export function generatePdfDocumentationBlob(parsed: OpenApiParsedDoc): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 50;
  const maxWidth = 515;

  const ensureSpace = (needed = 40) => {
    if (y + needed > 790) {
      doc.addPage();
      y = 50;
    }
  };

  doc.setFontSize(18);
  doc.text(`${parsed.title} (v${parsed.version})`, marginX, y);
  y += 22;

  if (parsed.description) {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(parsed.description, maxWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 14 + 10;
  }

  for (const ep of parsed.endpoints) {
    ensureSpace(80);
    doc.setFontSize(12);
    doc.text(`${ep.method} ${ep.path}`, marginX, y);
    y += 16;

    if (ep.summary) {
      doc.setFontSize(10);
      doc.text(ep.summary, marginX, y);
      y += 14;
    }

    if (ep.parameters.length > 0) {
      doc.setFontSize(9);
      const paramLine = `Parameters: ${ep.parameters
        .map((p) => `${p.name} (${p.in}${p.required ? ', required' : ''})`)
        .join(', ')}`;
      const wrapped = doc.splitTextToSize(paramLine, maxWidth);
      ensureSpace(wrapped.length * 12);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 12 + 4;
    }

    const resLine = `Responses: ${ep.responses.map((r) => r.statusCode).join(', ') || 'None'}`;
    doc.setFontSize(9);
    doc.text(resLine, marginX, y);
    y += 20;
  }

  return doc.output('blob');
}
