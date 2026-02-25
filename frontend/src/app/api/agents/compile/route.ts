import { NextResponse } from 'next/server'
import solc from 'solc'

const REQUIRED_FUNCTIONS = new Set(['attack', 'getName', 'owner'])

const hasRequiredFunctions = (abi: unknown) => {
  if (!Array.isArray(abi)) {
    return false
  }

  return Array.from(REQUIRED_FUNCTIONS).every((name) =>
    abi.some((entry) =>
      entry?.type === 'function' && entry?.name === name,
    ),
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!code) {
    return NextResponse.json({ error: 'Solidity code is required' }, { status: 400 })
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
      return NextResponse.json({ error: errors.join('\n') }, { status: 400 })
    }
  }

  const contracts = output.contracts?.['Agent.sol'] ?? {}

  for (const [contractName, artifact] of Object.entries(contracts)) {
    const abi = (artifact as { abi?: unknown }).abi
    const bytecodeObject = (artifact as { evm?: { bytecode?: { object?: string } } })
      .evm?.bytecode?.object

    if (!bytecodeObject || !hasRequiredFunctions(abi)) {
      continue
    }

    const bytecode = `0x${bytecodeObject}`

    if (bytecode === '0x') {
      continue
    }

    return NextResponse.json({
      abi,
      bytecode,
      contractName,
    })
  }

  return NextResponse.json(
    { error: 'No contract with required IAgent functions found' },
    { status: 400 },
  )
}
