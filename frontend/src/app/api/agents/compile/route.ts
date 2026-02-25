import { NextResponse } from 'next/server'
import solc from 'solc'

export const runtime = 'nodejs'

type CompileError = {
  severity?: string
  formattedMessage?: string
}

type CompileOutput = {
  contracts?: Record<string, Record<string, { abi: unknown; evm?: { bytecode?: { object?: string } } }>>
  errors?: CompileError[]
}

export const POST = async (request: Request) => {
  let body: { code?: unknown }

  try {
    body = (await request.json()) as { code?: unknown }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
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
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as CompileOutput
  const errors = output.errors?.filter((error) => error.severity === 'error') ?? []
  if (errors.length > 0) {
    const message = errors
      .map((error) => error.formattedMessage)
      .filter(Boolean)
      .join('\n')
    return NextResponse.json({ error: message || 'Compilation failed' }, { status: 400 })
  }

  const contract = output.contracts?.['Agent.sol']?.['GeneratedAgent']
  if (!contract) {
    return NextResponse.json({ error: 'GeneratedAgent contract not found' }, { status: 400 })
  }

  const bytecodeObject = contract.evm?.bytecode?.object
  if (!bytecodeObject) {
    return NextResponse.json({ error: 'Bytecode not found' }, { status: 400 })
  }

  return NextResponse.json({
    abi: contract.abi,
    bytecode: `0x${bytecodeObject}`,
  })
}
