import { NextResponse } from 'next/server'

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

  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing OPENROUTER_API_KEY environment variable' },
      { status: 500 },
    )
  }

  const systemPrompt = [
    'You are a Solidity code generator.',
    'Return ONLY Solidity code, no markdown or commentary.',
    'Generate a contract named GeneratedAgent that implements:',
    'interface IAgent { function attack(address) external; function getName() external view returns (string memory); function owner() external view returns (address); }',
    'Implement attack(address) and getName() as required.',
    'Use pragma solidity ^0.8.19; and SPDX MIT.',
  ].join(' ')

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reach OpenRouter' },
      { status: 502 },
    )
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: `OpenRouter request failed: ${response.status} ${response.statusText}`,
      },
      { status: 502 },
    )
  }

  let data: {
    choices?: Array<{ message?: { content?: unknown } }>
  }

  try {
    data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'OpenRouter returned invalid JSON' },
      { status: 500 },
    )
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json(
      { error: 'OpenRouter response missing Solidity code' },
      { status: 500 },
    )
  }

  return NextResponse.json({ code: content.trim() })
}
