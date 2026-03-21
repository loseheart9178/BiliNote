/* BatchImport.tsx - 批量导入视频链接组件 */
import { useState, useCallback, useEffect } from 'react'
import { Upload, FileText, X, Check, AlertCircle, Loader2, RefreshCw, Info } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Alert, AlertDescription } from '@/components/ui/alert.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.tsx'
import { Label } from '@/components/ui/label.tsx'
import toast from 'react-hot-toast'
import { generateNote } from '@/services/note.ts'
import { useTaskStore } from '@/store/taskStore'
import { useModelStore } from '@/store/modelStore'
import { noteStyles, noteFormats, videoPlatforms } from '@/constant/note'

export interface BatchTask {
  id: string
  url: string
  platform: string
  status: 'pending' | 'running' | 'success' | 'failed'
  error?: string
  task_id?: string
}

const SectionHeader = ({ title, tip }: { title: string; tip?: string }) => (
  <div className="my-3 flex items-center justify-between">
    <h2 className="block text-sm font-medium">{title}</h2>
    {tip && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="hover:text-primary h-4 w-4 cursor-pointer text-neutral-400" />
          </TooltipTrigger>
          <TooltipContent className="text-xs">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
)

const CheckboxGroup = ({
  value = [],
  onChange,
  disabledMap,
}: {
  value?: string[]
  onChange: (v: string[]) => void
  disabledMap: Record<string, boolean>
}) => (
  <div className="flex flex-wrap space-x-1.5">
    {noteFormats.map(({ label, value: v }) => (
      <label key={v} className="flex items-center space-x-2">
        <Checkbox
          checked={value.includes(v)}
          disabled={disabledMap[v]}
          onCheckedChange={checked =>
            onChange(checked ? [...value, v] : value.filter(x => x !== v))
          }
        />
        <span className="text-sm">{label}</span>
      </label>
    ))}
  </div>
)

const BatchImport = () => {
  const [urlText, setUrlText] = useState('')
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1)

  // 表单状态
  const [platform, setPlatform] = useState('bilibili')
  const [quality, setQuality] = useState('medium')
  const [model_name, setModelName] = useState('')
  const [provider_id, setProviderId] = useState('')
  const [style, setStyle] = useState('minimal')
  const [format, setFormat] = useState<string[]>([])
  const [extras, setExtras] = useState('')
  const [screenshot, setScreenshot] = useState(false)
  const [link, setLink] = useState(false)
  const [video_understanding, setVideoUnderstanding] = useState(false)
  const [video_interval, setVideoInterval] = useState(6)
  const [grid_size, setGridSize] = useState<number[]>([2, 2])

  const { addPendingTask } = useTaskStore()
  const { modelList, loadEnabledModels } = useModelStore()

  useEffect(() => {
    loadEnabledModels()
    if (modelList.length > 0 && !model_name) {
      setModelName(modelList[0].model_name)
      setProviderId(modelList[0].provider_id)
    }
  }, [modelList.length, loadEnabledModels])

  useEffect(() => {
    const model = modelList.find(m => m.model_name === model_name)
    if (model) {
      setProviderId(model.provider_id)
    }
  }, [model_name, modelList])

  // 解析URL列表
  const parseUrls = useCallback((text: string): string[] => {
    return text
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)
  }, [])

  // 从文件导入
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setUrlText(content)
      toast.success('文件导入成功')
    }
    reader.onerror = () => {
      toast.error('文件读取失败')
    }
    reader.readAsText(file)
  }, [])

  // 开始批量处理
  const handleStartBatch = useCallback(async () => {
    const urls = parseUrls(urlText)
    if (urls.length === 0) {
      toast.error('请输入视频链接')
      return
    }

    if (!model_name || !provider_id) {
      toast.error('请先配置好模型')
      return
    }

    // 创建任务列表
    const newTasks: BatchTask[] = urls.map((url, index) => ({
      id: `batch-${Date.now()}-${index}`,
      url,
      platform,
      status: 'pending',
    }))

    setTasks(newTasks)
    setIsProcessing(true)
    setCurrentProcessingIndex(0)

    // 逐个处理任务
    for (let i = 0; i < newTasks.length; i++) {
      const task = newTasks[i]

      // 如果用户停止处理，退出循环
      if (!isProcessing && i > 0) break

      setCurrentProcessingIndex(i)
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'running' } : t
      ))

      try {
        const response = await generateNote({
          video_url: task.url,
          platform,
          quality: quality as any,
          model_name,
          provider_id,
          format,
          style,
          extras,
          screenshot,
          link,
          video_understanding,
          video_interval,
          grid_size,
        })

        // 添加到主任务列表
        addPendingTask(response.task_id, platform, {
          video_url: task.url,
          link,
          screenshot,
          platform,
          quality,
          model_name,
          provider_id,
          format,
          style,
          extras,
          video_understanding,
          video_interval,
          grid_size,
        })

        setTasks(prev => prev.map(t =>
          t.id === task.id
            ? { ...t, status: 'success', task_id: response.task_id }
            : t
        ))

        toast.success(`任务 ${i + 1}/${newTasks.length} 已提交`, {
          id: `batch-toast-${task.id}`,
        })
      } catch (error: any) {
        console.error(`批量任务 ${task.id} 失败:`, error)
        setTasks(prev => prev.map(t =>
          t.id === task.id
            ? { ...t, status: 'failed', error: error?.message || '未知错误' }
            : t
        ))
        toast.error(`任务 ${i + 1}/${newTasks.length} 失败`, {
          id: `batch-toast-${task.id}`,
        })
      }
    }

    setIsProcessing(false)
    setCurrentProcessingIndex(-1)

    // 统计结果
    const successCount = newTasks.filter(t => t.status === 'success').length
    const failedCount = newTasks.filter(t => t.status === 'failed').length

    toast.success(`批量处理完成！成功: ${successCount}, 失败: ${failedCount}`)
  }, [urlText, platform, quality, model_name, provider_id, format, style, extras, screenshot, link, video_understanding, video_interval, grid_size, isProcessing, addPendingTask, parseUrls])

  // 单独重试失败的任务
  const handleRetryTask = useCallback(async (task: BatchTask) => {
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: 'running' } : t
    ))

    try {
      const response = await generateNote({
        video_url: task.url,
        platform,
        quality: quality as any,
        model_name,
        provider_id,
        format,
        style,
        extras,
        screenshot,
        link,
        video_understanding,
        video_interval,
        grid_size,
      })

      addPendingTask(response.task_id, platform, {
        video_url: task.url,
        link,
        screenshot,
        platform,
        quality,
        model_name,
        provider_id,
        format,
        style,
        extras,
        video_understanding,
        video_interval,
        grid_size,
      })

      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'success', task_id: response.task_id }
          : t
      ))

      toast.success('重试成功')
    } catch (error: any) {
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'failed', error: error?.message || '未知错误' }
          : t
      ))
      toast.error('重试失败')
    }
  }, [platform, quality, model_name, provider_id, format, style, extras, screenshot, link, video_understanding, video_interval, grid_size, addPendingTask])

  // 清空任务列表
  const handleClearTasks = useCallback(() => {
    setTasks([])
    setUrlText('')
  }, [])

  // 获取状态图标
  const getStatusIcon = (task: BatchTask) => {
    switch (task.status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return null
    }
  }

  // 获取状态文字
  const getStatusText = (status: BatchTask['status']) => {
    switch (status) {
      case 'success':
        return '成功'
      case 'failed':
        return '失败'
      case 'running':
        return '处理中'
      default:
        return '等待中'
    }
  }

  const successCount = tasks.filter(t => t.status === 'success').length
  const failedCount = tasks.filter(t => t.status === 'failed').length
  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const runningCount = tasks.filter(t => t.status === 'running').length

  return (
    <div className="space-y-4">
      {/* 笔记生成设置 */}
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">批量处理设置</h3>

        {/* 平台选择 */}
        <div className="flex items-center gap-2">
          <Label className="text-sm">平台:</Label>
          <Select value={platform} onValueChange={setPlatform} disabled={isProcessing}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {videoPlatforms?.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4">{p.logo()}</div>
                    <span>{p.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 模型选择 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-sm">模型:</Label>
            <Select
              value={model_name}
              onValueChange={setModelName}
              disabled={isProcessing}
              onOpenChange={() => loadEnabledModels()}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelList.map(m => (
                  <SelectItem key={m.id} value={m.model_name}>
                    {m.model_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">笔记风格:</Label>
            <Select value={style} onValueChange={setStyle} disabled={isProcessing}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {noteStyles.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 笔记格式 */}
        <div className="space-y-1">
          <Label className="text-sm">笔记格式:</Label>
          <CheckboxGroup
            value={format}
            onChange={setFormat}
            disabledMap={{
              link: platform === 'local',
              screenshot: !video_understanding,
            }}
          />
        </div>

        {/* 视频理解 */}
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm">启用视频理解</Label>
            <Checkbox
              checked={video_understanding}
              onCheckedChange={setVideoUnderstanding}
              disabled={isProcessing}
            />
          </div>

          {video_understanding && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">采样间隔（秒）</Label>
                <Input
                  type="number"
                  value={video_interval}
                  onChange={(e) => setVideoInterval(Number(e.target.value))}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">拼图尺寸</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    value={grid_size[0]}
                    onChange={(e) => setGridSize([Number(e.target.value), grid_size[1]])}
                    disabled={isProcessing}
                    className="w-16"
                  />
                  <span>x</span>
                  <Input
                    type="number"
                    value={grid_size[1]}
                    onChange={(e) => setGridSize([grid_size[0], Number(e.target.value)])}
                    disabled={isProcessing}
                    className="w-16"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">批量导入视频链接</h3>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={isProcessing}
              >
                <FileText className="h-4 w-4" />
                导入文件
              </Button>
            </label>
          </div>
        </div>

        <Textarea
          placeholder="请输入视频链接，每行一个&#10;例如：&#10;https://www.bilibili.com/video/xxx&#10;https://www.bilibili.com/video/yyy"
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          disabled={isProcessing}
          className="min-h-[150px] resize-none"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {urlText ? `共 ${parseUrls(urlText).length} 个链接` : ''}
          </span>
          <Button
            type="button"
            onClick={handleStartBatch}
            disabled={isProcessing || !urlText.trim() || !model_name || !provider_id}
            className="gap-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                开始批量处理
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">任务列表</h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                等待: {pendingCount}
              </Badge>
              <Badge variant="secondary" className="text-xs text-blue-600">
                处理中: {runningCount}
              </Badge>
              <Badge variant="secondary" className="text-xs text-green-600">
                成功: {successCount}
              </Badge>
              <Badge variant="secondary" className="text-xs text-red-600">
                失败: {failedCount}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearTasks}
                disabled={isProcessing}
                className="h-6 px-2"
              >
                <X className="h-3 w-3" />
                清空
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[400px] rounded-md border">
            <div className="space-y-1 p-2">
              {tasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                    task.status === 'running'
                      ? 'bg-blue-50 border-blue-200'
                      : task.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : task.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="w-6 text-xs text-gray-500">{index + 1}.</span>
                  <div className="flex-1 min-w-0 truncate text-xs">
                    {task.url}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${
                      task.status === 'success'
                        ? 'border-green-300 text-green-700'
                        : task.status === 'failed'
                        ? 'border-red-300 text-red-700'
                        : task.status === 'running'
                        ? 'border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    {getStatusIcon(task)}
                    {getStatusText(task.status)}
                  </Badge>
                  {task.status === 'failed' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetryTask(task)}
                      disabled={isProcessing}
                      className="h-6 px-2 gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      重试
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* 错误提示 */}
      {failedCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            有 {failedCount} 个任务失败，请检查视频链接是否正确后重试
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default BatchImport
