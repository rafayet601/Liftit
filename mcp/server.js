#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, callTool, formatToolResult, loadDoc } from './tools.js';

const docPath = process.argv[2] || process.env.LIFTIT_DOC;

if (!docPath) {
    console.error(
        'liftit-mcp: no export path given. Usage: node mcp/server.js /path/to/liftit_data.json (or set LIFTIT_DOC).',
    );
    process.exit(1);
}

console.error(`liftit-mcp: serving ${docPath} (read-only; loaded on first tool call)`);

function getDoc() {
    return loadDoc(docPath);
}

const server = new Server(
    { name: 'liftit-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    try {
        const doc = getDoc();
        const result = callTool(doc, name, args);
        return formatToolResult(result);
    } catch (err) {
        console.error(`liftit-mcp: tool "${name}" failed: ${err.message}`);
        return {
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            isError: true,
        };
    }
});

server.onclose = () => process.exit(0);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('liftit-mcp: stdio transport connected, waiting for requests');
}

main().catch((err) => {
    console.error(`liftit-mcp: fatal: ${err?.message ?? err}`);
    process.exit(1);
});
