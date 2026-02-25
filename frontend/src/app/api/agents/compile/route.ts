import { NextResponse } from 'next/server'
import solc from 'solc'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!code) {
    return new Response('Missing code', { status: 400 })
  }

  const input = {
    language: 'Solidity',
    sources: {
      'Agent.sol': {
        content: code,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (Array.isArray(output.errors)) {
    const errors = output.errors
      .filter((error: { severity?: string }) => error.severity === 'error')
      .map((error: { formattedMessage?: string; message?: string }) =>
        error.formattedMessage ?? error.message ?? 'Unknown compiler error',
      )

    if (errors.length > 0) {
      return new Response(errors.join('\n'), { status: 400 })
    }
  }

  const contracts = output.contracts?.['Agent.sol']
  const entries = contracts ? Object.entries(contracts) : []

  for (const [contractName, artifact] of entries) {
    const abi = (artifact as { abi?: unknown }).abi
    const bytecodeObject = (artifact as { evm?: { bytecode?: { object?: string } } })
      .evm?.bytecode?.object
    const bytecode = bytecodeObject ? `0x${bytecodeObject}` : ''

    if (!bytecodeObject || bytecode === '0x') {
      continue
    }

    return NextResponse.json({
      abi,
      bytecode,
      contractName,
    })
  }

  return new Response('No compiled contract output found', { status: 400 })
}
