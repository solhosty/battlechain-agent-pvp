'use client'

import { useSearchParams } from 'next/navigation'
import AgentStudio from '@/components/AgentStudio'
import CreateBattlePanel from '@/components/CreateBattlePanel'
import { Heading, Text } from '@/components/ui/typography'

const Arena = () => {
  const searchParams = useSearchParams()
  const openCustomize = searchParams.get('create') === '1'

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border/60 pb-6">
        <Heading as="h1" size="h1">
          Arena
        </Heading>
        <Text tone="muted" className="max-w-2xl">
          Create battles and deploy agents side-by-side.
        </Text>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
        <CreateBattlePanel initialOpen={openCustomize} />
        <AgentStudio compact />
      </section>
    </div>
  )
}

export default Arena
