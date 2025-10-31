import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createServer } from '../src/index.js'

describe('createServer', () => {
  it('creates an MCP server instance', () => {
    const server = createServer()
    expect(server).toBeInstanceOf(McpServer)
  })
})
