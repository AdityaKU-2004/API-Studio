import React, { useMemo, useState } from 'react';
import {
  Braces,
  FileCode2,
  KeyRound,
  Binary,
  Link2,
  Hash,
  Fingerprint,
  Clock,
  Terminal,
  Palette,
  Regex,
  ShieldCheck,
  Search,
  Star,
  Wrench,
} from 'lucide-react';
import { DeveloperToolId } from '../../types';
import { useDeveloperToolsStore } from '../../stores/developerToolsStore';
import { JsonFormatterTool } from './components/JsonFormatterTool';
import { JsonToTsTool } from './components/JsonToTsTool';
import { JwtDecoderTool } from './components/JwtDecoderTool';
import { Base64Tool } from './components/Base64Tool';
import { UrlCodecTool } from './components/UrlCodecTool';
import { HashGeneratorTool } from './components/HashGeneratorTool';
import { UuidGeneratorTool } from './components/UuidGeneratorTool';
import { TimestampTool } from './components/TimestampTool';
import { CurlTool } from './components/CurlTool';
import { ColorConverterTool } from './components/ColorConverterTool';
import { RegexTesterTool } from './components/RegexTesterTool';
import { SslInspectorTool } from './components/SslInspectorTool';

interface ToolMetadata {
  id: DeveloperToolId;
  name: string;
  category: 'Data Formatting' | 'Tokens & Encoding' | 'Crypto & IDs' | 'Web & Debugging' | 'Security & TLS';
  description: string;
  icon: React.ReactNode;
}

const TOOL_DEFINITIONS: ToolMetadata[] = [
  {
    id: 'json-formatter',
    name: 'JSON Formatter & Validator',
    category: 'Data Formatting',
    description: 'Beautify, minify, validate syntax with line/column diagnostics',
    icon: <Braces className="w-4 h-4" />,
  },
  {
    id: 'json-to-ts',
    name: 'JSON → TypeScript',
    category: 'Data Formatting',
    description: 'Infer TypeScript interfaces from sample JSON payloads',
    icon: <FileCode2 className="w-4 h-4" />,
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder (Local)',
    category: 'Tokens & Encoding',
    description: 'Inspect Base64URL header, claims & expiration locally',
    icon: <KeyRound className="w-4 h-4" />,
  },
  {
    id: 'base64',
    name: 'Base64 Codec',
    category: 'Tokens & Encoding',
    description: 'Unicode-safe UTF-8 Base64 encoding and decoding',
    icon: <Binary className="w-4 h-4" />,
  },
  {
    id: 'url-codec',
    name: 'URL Encoder & Query Builder',
    category: 'Tokens & Encoding',
    description: 'Component/URI encoding plus interactive query string parser',
    icon: <Link2 className="w-4 h-4" />,
  },
  {
    id: 'hash-generator',
    name: 'Hash Generator',
    category: 'Crypto & IDs',
    description: 'Local Web Crypto SHA-256, SHA-384, and SHA-512 for text & files',
    icon: <Hash className="w-4 h-4" />,
  },
  {
    id: 'uuid-generator',
    name: 'UUID v4 Generator',
    category: 'Crypto & IDs',
    description: 'CSPRNG batch UUID v4 generator with one-click copy',
    icon: <Fingerprint className="w-4 h-4" />,
  },
  {
    id: 'timestamp',
    name: 'Timestamp Converter',
    category: 'Crypto & IDs',
    description: 'Convert Unix seconds/ms, ISO 8601, UTC, and local timestamps',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    id: 'curl',
    name: 'cURL Inspector & Builder',
    category: 'Web & Debugging',
    description: 'Safely parse cURL commands, flag unsupported options, export tab',
    icon: <Terminal className="w-4 h-4" />,
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    category: 'Web & Debugging',
    description: 'Convert HEX, RGB/RGBA, and HSL/HSLA with live swatch preview',
    icon: <Palette className="w-4 h-4" />,
  },
  {
    id: 'regex-tester',
    name: 'Safe Regex Tester',
    category: 'Web & Debugging',
    description: 'Match & capture group inspector with ReDoS backtracking guard',
    icon: <Regex className="w-4 h-4" />,
  },
  {
    id: 'ssl-inspector',
    name: 'SSL / TLS Inspector',
    category: 'Security & TLS',
    description: 'Honest browser TLS boundary check & Phase 7 native contract',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
];

export const DeveloperToolsDashboard: React.FC = () => {
  const { activeTool, preferences, setActiveTool, toggleFavoriteTool } = useDeveloperToolsStore();
  const [search, setSearch] = useState('');

  const favorites = preferences.favoriteTools || [];

  const filteredTools = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matching = TOOL_DEFINITIONS.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
    return matching.sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });
  }, [search, favorites]);

  const currentMeta = TOOL_DEFINITIONS.find((t) => t.id === activeTool) || TOOL_DEFINITIONS[0];

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'json-formatter':
        return <JsonFormatterTool />;
      case 'json-to-ts':
        return <JsonToTsTool />;
      case 'jwt-decoder':
        return <JwtDecoderTool />;
      case 'base64':
        return <Base64Tool />;
      case 'url-codec':
        return <UrlCodecTool />;
      case 'hash-generator':
        return <HashGeneratorTool />;
      case 'uuid-generator':
        return <UuidGeneratorTool />;
      case 'timestamp':
        return <TimestampTool />;
      case 'curl':
        return <CurlTool />;
      case 'color-converter':
        return <ColorConverterTool />;
      case 'regex-tester':
        return <RegexTesterTool />;
      case 'ssl-inspector':
        return <SslInspectorTool />;
      default:
        return <JsonFormatterTool />;
    }
  };

  return (
    <div className="flex h-full bg-[#0a0d13] text-slate-200 overflow-hidden select-none">
      {/* Left Tool Catalog */}
      <div className="w-72 border-r border-slate-800/80 bg-[#0d1017] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Developer Utilities
            </h2>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter utilities..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredTools.map((tool) => {
            const isSelected = activeTool === tool.id;
            const isFav = favorites.includes(tool.id);
            return (
              <div
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/35'
                    : 'hover:bg-slate-900/70 text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={isSelected ? 'text-cyan-400' : 'text-slate-400'}>{tool.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{tool.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{tool.category}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFavoriteTool(tool.id);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isFav ? 'text-amber-400' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                  }`}
                  title={isFav ? 'Remove from favorites' : 'Pin to top'}
                >
                  <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Tool Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0d1017]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-cyan-400">{currentMeta.icon}</span>
            <div>
              <h1 className="text-sm font-semibold text-slate-100">{currentMeta.name}</h1>
              <p className="text-[11px] text-slate-400">{currentMeta.description}</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            100% Local Browser Execution
          </span>
        </div>

        <div className="flex-1 p-5 overflow-hidden">{renderActiveTool()}</div>
      </div>
    </div>
  );
};
