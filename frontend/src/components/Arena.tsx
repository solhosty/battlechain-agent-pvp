'use client'

import { useSearchParams } from 'next/navigation'
import AgentStudio from '@/components/AgentStudio'
import CreateBattlePanel from '@/components/CreateBattlePanel'
import { Heading, Text } from '@/components/ui/typography'

const Arena = () => {
  const searchParams = useSearchParams()
  const openCustomize = searchParams.get('create') === '1'

  return (
    <div className="py-10">
      <header className="mb-8 space-y-2">
        <Heading as="h1" size="h1">
          Arena
        </Heading>
        <Text tone="muted">Create battles and deploy agents side-by-side.</Text>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <CreateBattlePanel initialOpen={openCustomize} />
        <AgentStudio compact />
      </section>
    </div>
  )
}

export default Arena
