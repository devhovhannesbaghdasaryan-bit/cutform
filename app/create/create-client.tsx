'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { toast } from 'sonner';
import { Loader2, Send, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SvgRender } from '@/components/svg-render';
import { generationSchema } from '@/lib/generation-schema';
import { PRODUCT_TYPES, type ProductType } from '@/lib/marketplace-constants';
import { startSession, approveSession } from './actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface UploadedImage {
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  previewUrl: string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function CreateClient({
  initialProductType = 'laser_cut_2d_decoration',
  mode = 'laser-cut-2d',
}: {
  initialProductType?: ProductType;
  mode?: 'generic' | 'night-light' | 'laser-cut-2d';
}) {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [editableTitle, setEditableTitle] = useState('');
  const [productType, setProductType] = useState<ProductType>(initialProductType);
  const [standText, setStandText] = useState('');
  const [sizePreset, setSizePreset] = useState('medium');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [approving, startApproving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { object, submit, isLoading, stop } = useObject({
    api: '/api/generate',
    schema: generationSchema,
    onFinish: ({ object: finalObject }) => {
      if (!finalObject) return;
      setMessages((m) => [...m, { role: 'assistant', content: finalObject.explanation }]);
      setEditableTitle(finalObject.title);
    },
    onError: (e) => {
      toast.error(e.message || 'Generation failed. Try again.');
    },
  });

  const livePreviewSvg = object?.svg ?? '';
  const liveTitle = (object?.title ?? editableTitle) || '';

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!rightsConfirmed) {
      toast.error('Confirm that you have rights to use the uploaded image.');
      e.target.value = '';
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error('Only PNG, JPEG, or WebP are accepted.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image exceeds 5 MB limit.');
      e.target.value = '';
      return;
    }
    const base64 = await fileToBase64(file);
    const mimeType = file.type as UploadedImage['mimeType'];
    const previewUrl = URL.createObjectURL(file);
    try {
      const { sessionId: newId } = await startSession({
        imageBase64: base64,
        mimeType,
        rightsConfirmed,
      });
      setSessionId(newId);
      setImage({ base64, mimeType, previewUrl });
      toast.success('Image uploaded. Now describe what you want.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
      URL.revokeObjectURL(previewUrl);
    }
  }, [rightsConfirmed]);

  const handleSend = useCallback(() => {
    if (!sessionId || !image || !input.trim() || isLoading) return;
    const details = [
      mode === 'night-light' ? 'Generate a night light design with acrylic engraving and a wood base.' : null,
      mode === 'laser-cut-2d' ? `Generate a ${productType.replaceAll('_', ' ')} with cut and engrave layers.` : null,
      standText.trim() ? `Wood base text: ${standText.trim().slice(0, 100)}.` : null,
      sizePreset ? `Preferred size: ${sizePreset}.` : null,
    ].filter(Boolean).join('\n');
    const message = `${details ? `${details}\n\n` : ''}${input.trim()}`;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    submit({
      sessionId,
      message,
      imageBase64: image.base64,
      mimeType: image.mimeType,
    });
  }, [sessionId, image, input, isLoading, mode, productType, sizePreset, standText, submit]);

  const handleApprove = useCallback(() => {
    if (!sessionId || !livePreviewSvg) return;
    startApproving(async () => {
      try {
        await approveSession({
          sessionId,
          title: editableTitle.trim() || liveTitle,
          productType,
        });
        // approveSession redirects on success; if it returns, something odd happened.
      } catch (err) {
        // Next.js redirect throws a NEXT_REDIRECT sentinel — not a real error.
        const msg = err instanceof Error ? err.message : 'Approval failed.';
        if (!msg.includes('NEXT_REDIRECT')) toast.error(msg);
      }
    });
  }, [editableTitle, livePreviewSvg, liveTitle, productType, sessionId]);

  const previewPane = (
    <Card className="flex h-[60vh] items-center justify-center md:h-[calc(100vh-12rem)]">
      <CardContent className="flex h-full w-full items-center justify-center p-6">
        {isLoading && !livePreviewSvg && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Generating…</p>
          </div>
        )}
        {!isLoading && !livePreviewSvg && !image && (
          <div className="text-center text-sm text-muted-foreground">
            <Upload className="mx-auto mb-2 h-8 w-8" />
            Upload a reference image to begin.
          </div>
        )}
        {!isLoading && !livePreviewSvg && image && (
          <p className="text-sm text-muted-foreground">Send a message to generate the first SVG.</p>
        )}
        {livePreviewSvg && <SvgRender svg={livePreviewSvg} className="h-full w-full" />}
      </CardContent>
    </Card>
  );

  const chatPane = (
    <Card className="flex h-[60vh] flex-col md:h-[calc(100vh-12rem)]">
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        {!image && (
          <div className="flex flex-1 flex-col gap-3">
            <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>I have the rights to use the uploaded image.</span>
            </label>
            <label
              htmlFor="image-upload"
              className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center hover:bg-accent"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Upload a reference image</p>
              <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP up to 5 MB.</p>
              <input
                ref={fileInputRef}
                id="image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={!rightsConfirmed}
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}

        {image && (
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview, not a static asset */}
            <img
              src={image.previewUrl}
              alt="Reference"
              className="h-16 w-16 rounded object-cover"
            />
            <div className="flex-1 text-sm">
              <p className="font-medium">Reference image</p>
              <p className="text-xs text-muted-foreground">{image.mimeType}</p>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.length === 0 && image && (
            <p className="text-sm text-muted-foreground">
              Describe what you want — e.g., &quot;turn this logo into clean cuttable lines.&quot;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-8 rounded-md bg-primary p-3 text-sm text-primary-foreground'
                  : 'mr-8 rounded-md bg-muted p-3 text-sm'
              }
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="mr-8 space-y-2 rounded-md bg-muted p-3">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          )}
        </div>

        {image && (
          <div className="space-y-2 border-t pt-3">
            {mode === 'night-light' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={standText}
                  onChange={(event) => setStandText(event.target.value.slice(0, 100))}
                  placeholder="Wood base text"
                />
                <select
                  value={sizePreset}
                  onChange={(event) => setSizePreset(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            )}
            {mode === 'laser-cut-2d' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={productType}
                  onChange={(event) => setProductType(event.target.value as ProductType)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="laser_cut_2d_toy">Toy</option>
                  <option value="laser_cut_2d_decoration">Decoration</option>
                  <option value="laser_cut_2d_constructor">Constructor</option>
                </select>
                <select
                  value={sizePreset}
                  onChange={(event) => setSizePreset(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Estimated credit cost is based on model usage and shown before saving.
            </p>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={messages.length === 0 ? 'What should the SVG look like?' : 'Ask for a refinement…'}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">⌘+Enter to send</p>
              <div className="flex gap-2">
                {isLoading && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => stop()}>
                    Stop
                  </Button>
                )}
                <Button type="button" size="sm" onClick={handleSend} disabled={isLoading || !input.trim()}>
                  <Send className="mr-1 h-4 w-4" /> Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const approveBar = livePreviewSvg && !isLoading && (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <div className="space-y-1">
            <label htmlFor="approve-title" className="text-sm font-medium">
              Product title
            </label>
            <Input
              id="approve-title"
              value={editableTitle}
              onChange={(e) => setEditableTitle(e.target.value)}
              placeholder={liveTitle}
              className="max-w-md"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="product-type" className="text-sm font-medium">
              Product type
            </label>
            <select
              id="product-type"
              value={productType}
              onChange={(event) => setProductType(event.target.value as ProductType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PRODUCT_TYPES.filter((type) => type !== 'personalized_night_light' && type !== 'banner').map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Saving creates a generated item. Generated previews are approximations and require production review before manufacturing. Price starts with a $10.00 markup plus API usage cost.
        </p>
      </div>
      <Button onClick={handleApprove} disabled={approving || !(editableTitle.trim() || liveTitle)}>
        {approving ? 'Approving…' : 'Approve and save'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mobile: tabs. Desktop: side-by-side. */}
      <div className="md:hidden">
        <Tabs defaultValue="chat">
          <TabsList className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              Chat
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">
              Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat">{chatPane}</TabsContent>
          <TabsContent value="preview">{previewPane}</TabsContent>
        </Tabs>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        {chatPane}
        {previewPane}
      </div>

      {approveBar}
    </div>
  );
}
