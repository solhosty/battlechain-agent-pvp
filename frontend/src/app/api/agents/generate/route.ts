import { NextResponse } from 'next/server'

const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const SYSTEM_PROMPT = `You are a Solidity compiler assistant. Return only Solidity code for a single contract with no imports. The contract must implement the IAgent interface with these functions:
- function attack(address target, bytes calldata data) external
- function getName() external view returns (string memory)
- function owner() external view returns (address)
Use Solidity ^0.8.x. Do not include Markdown fences or explanations.`

const parseErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null)
    return payload?.error ?? payload?.message ?? ''
  }

  return response.text()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

  if (!prompt) {
    return new Response('Missing prompt', { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL ?? 'openrouter/auto'
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_URL

  if (!apiKey) {
    return new Response('Missing OpenRouter API key', { status: 500 })
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const message = (await parseErrorMessage(response)) ||
      `OpenRouter request failed (${response.status})`
    return new Response(message, { status: response.status })
  }

  const data = await response.json().catch(() => null)
  const raw = data?.choices?.[0]?.message?.content ?? ''
  const code = raw
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()

  if (!code) {
    return new Response('Model returned no code', { status: 502 })
  }

  return NextResponse.json({ code })
}
