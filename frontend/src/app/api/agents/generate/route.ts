import { NextResponse } from 'next/server'
import { buildAgentTemplate } from '@/server/agentTemplate'

export const runtime = 'nodejs'

export const POST = async (request: Request) => {
  let body: { prompt?: unknown }

  try {
    body = (await request.json()) as { prompt?: unknown }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const code = buildAgentTemplate(prompt)
  return NextResponse.json({ code })
}
