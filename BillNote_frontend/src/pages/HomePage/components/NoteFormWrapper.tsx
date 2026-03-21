import NoteForm from './NoteForm.tsx'
import BatchImport from './BatchImport.tsx'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.tsx'
import { useState } from 'react'

const NoteFormWrapper = () => {
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="single">单个视频</TabsTrigger>
          <TabsTrigger value="batch">批量导入</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <NoteForm />
        </TabsContent>

        <TabsContent value="batch">
          <BatchImport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default NoteFormWrapper
