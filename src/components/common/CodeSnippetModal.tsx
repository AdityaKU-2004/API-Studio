import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Modal } from './Modal';
import { Copy, Check, Terminal } from 'lucide-react';

export const CodeSnippetModal: React.FC = () => {
  const { isCodeSnippetModalOpen, setCodeSnippetModalOpen } = useAppStore();
  const { tabs, activeTabId } = useRequestStore();
  const { getResolvedVariables } = useEnvironmentStore();

  const [language, setLanguage] = useState<'curl' | 'javascript' | 'python' | 'go' | 'rust'>('curl');
  const [copied, setCopied] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const request = activeTab?.request;

  const resolvedUrl = useMemo(() => {
    if (!request) return '';
    let url = request.url;
    const vars = getResolvedVariables();
    for (const [k, v] of Object.entries(vars)) {
      url = url.replaceAll(`{{${k}}}`, v);
    }
    return url;
  }, [request, getResolvedVariables]);

  const snippetCode = useMemo(() => {
    if (!request) return '// No active request';

    const enabledHeaders = request.headers.filter((h) => h.enabled && h.key);
    const bodyStr = request.bodyType === 'json' ? request.rawBody : '';

    if (language === 'curl') {
      let cmd = `curl --request ${request.method} \\\n  --url '${resolvedUrl}'`;
      enabledHeaders.forEach((h) => {
        cmd += ` \\\n  --header '${h.key}: ${h.value}'`;
      });
      if (bodyStr) {
        cmd += ` \\\n  --data '${bodyStr.replace(/'/g, "\\'")}'`;
      }
      return cmd;
    }

    if (language === 'javascript') {
      const headersObj = enabledHeaders.reduce((acc, h) => {
        acc[h.key] = h.value;
        return acc;
      }, {} as Record<string, string>);

      return `const response = await fetch('${resolvedUrl}', {
  method: '${request.method}',
  headers: ${JSON.stringify(headersObj, null, 4)},${bodyStr ? `\n  body: JSON.stringify(${bodyStr})` : ''}
});

const data = await response.json();
console.log(data);`;
    }

    if (language === 'python') {
      return `import requests

url = "${resolvedUrl}"
headers = {
${enabledHeaders.map((h) => `    "${h.key}": "${h.value}"`).join(',\n')}
}
${bodyStr ? `payload = ${bodyStr}\n\nresponse = requests.${request.method.toLowerCase()}(url, json=payload, headers=headers)` : `response = requests.${request.method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.json())`;
    }

    if (language === 'go') {
      return `package main

import (
    "fmt"
    "net/http"
    "io"
)

func main() {
    url := "${resolvedUrl}"
    req, _ := http.NewRequest("${request.method}", url, nil)
${enabledHeaders.map((h) => `    req.Header.Add("${h.key}", "${h.value}")`).join('\n')}
    res, err := http.DefaultClient.Do(req)
    if err != nil {
        panic(err)
    }
    defer res.Body.Close()
    body, _ := io.ReadAll(res.Body)
    fmt.Println(string(body))
}`;
    }

    if (language === 'rust') {
      return `// Rust (reqwest async)
use reqwest::header::HeaderMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std.error.Error>> {
    let client = reqwest::Client::new();
    let res = client
        .${request.method.toLowerCase()}("${resolvedUrl}")
${enabledHeaders.map((h) => `        .header("${h.key}", "${h.value}")`).join('\n')}
        .send()
        .await?;

    println!("Status: {}", res.status());
    let body = res.text().await?;
    println!("Body: {}", body);
    Ok(())
}`;
    }

    return '';
  }, [language, request, resolvedUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isCodeSnippetModalOpen}
      onClose={() => setCodeSnippetModalOpen(false)}
      title="Code Snippet Generator"
      description="Export active request into native code or shell commands"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Language selector tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-lg border border-slate-800">
          {(
            [
              { id: 'curl', label: 'cURL' },
              { id: 'javascript', label: 'JavaScript Fetch' },
              { id: 'python', label: 'Python (requests)' },
              { id: 'go', label: 'Go (net/http)' },
              { id: 'rust', label: 'Rust (reqwest)' },
            ] as const
          ).map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setLanguage(lang.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                language === lang.id
                  ? 'bg-blue-600/30 text-cyan-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Code snippet display */}
        <div className="relative rounded-lg bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-cyan-300 overflow-x-auto max-h-80">
          <pre>{snippetCode}</pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
