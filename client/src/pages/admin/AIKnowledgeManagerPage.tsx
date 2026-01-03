/**
 * AI Knowledge Manager Page
 * Admin interface for managing AI knowledge base entries
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  History,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Tag,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// API functions
async function fetchKnowledgeBase(params?: { category?: string; search?: string }) {
  const url = new URL('/api/ai/knowledge', window.location.origin);
  if (params?.category) url.searchParams.set('category', params.category);
  if (params?.search) url.searchParams.set('search', params.search);
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch knowledge base');
  return res.json();
}

async function fetchKnowledgeEntry(id: string) {
  const res = await fetch(`/api/ai/knowledge/${id}`);
  if (!res.ok) throw new Error('Failed to fetch entry');
  return res.json();
}

async function fetchKnowledgeHistory(id: string) {
  const res = await fetch(`/api/ai/knowledge/${id}/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

async function createKnowledgeEntry(data: KnowledgeFormData) {
  const res = await fetch('/api/ai/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create entry');
  return res.json();
}

async function updateKnowledgeEntry(id: string, data: Partial<KnowledgeFormData>) {
  const res = await fetch(`/api/ai/knowledge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

async function deleteKnowledgeEntry(id: string) {
  const res = await fetch(`/api/ai/knowledge/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete entry');
  return res.json();
}

async function rollbackKnowledgeEntry(id: string, version: number) {
  const res = await fetch(`/api/ai/knowledge/${id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) throw new Error('Failed to rollback entry');
  return res.json();
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  intents: string[];
  is_active: boolean;
  priority: number;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  usage_count: number;
}

interface KnowledgeFormData {
  title: string;
  content: string;
  category: string;
  keywords: string[];
  intents: string[];
  is_active: boolean;
  priority: number;
}

const CATEGORIES = [
  { value: 'pricing', label: 'Pricing & Billing' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'account', label: 'Account Management' },
  { value: 'feature', label: 'Feature Requests' },
  { value: 'integration', label: 'Integrations' },
  { value: 'security', label: 'Security & Compliance' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'general', label: 'General' },
];

export default function AIKnowledgeManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [intentsInput, setIntentsInput] = useState('');
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<KnowledgeFormData>({
    defaultValues: {
      title: '',
      content: '',
      category: 'general',
      keywords: [],
      intents: [],
      is_active: true,
      priority: 1,
    },
  });
  
  // Fetch data
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['knowledge', categoryFilter, searchQuery],
    queryFn: () => fetchKnowledgeBase({ 
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      search: searchQuery || undefined,
    }),
  });
  
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['knowledge', 'history', selectedEntry?.id],
    queryFn: () => selectedEntry ? fetchKnowledgeHistory(selectedEntry.id) : null,
    enabled: !!selectedEntry && showHistoryDialog,
  });
  
  const entries: KnowledgeEntry[] = entriesData?.entries || [];
  const history = historyData?.versions || [];
  
  // Mutations
  const createMutation = useMutation({
    mutationFn: createKnowledgeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setShowCreateDialog(false);
      reset();
      setKeywordsInput('');
      setIntentsInput('');
      toast({ title: 'Entry created', description: 'Knowledge base entry created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeFormData> }) => 
      updateKnowledgeEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setEditMode(false);
      toast({ title: 'Entry updated', description: 'Knowledge base entry updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setShowDeleteDialog(false);
      setSelectedEntry(null);
      toast({ title: 'Entry deleted', description: 'Knowledge base entry deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const rollbackMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => 
      rollbackKnowledgeEntry(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setShowHistoryDialog(false);
      toast({ title: 'Rollback complete', description: 'Entry restored to previous version' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const handleSelectEntry = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    setEditMode(false);
    setValue('title', entry.title);
    setValue('content', entry.content);
    setValue('category', entry.category);
    setValue('keywords', entry.keywords);
    setValue('intents', entry.intents);
    setValue('is_active', entry.is_active);
    setValue('priority', entry.priority);
    setKeywordsInput(entry.keywords.join(', '));
    setIntentsInput(entry.intents.join(', '));
  };
  
  const handleCreate = (data: KnowledgeFormData) => {
    createMutation.mutate({
      ...data,
      keywords: keywordsInput.split(',').map(k => k.trim()).filter(Boolean),
      intents: intentsInput.split(',').map(i => i.trim()).filter(Boolean),
    });
  };
  
  const handleUpdate = (data: KnowledgeFormData) => {
    if (!selectedEntry) return;
    updateMutation.mutate({
      id: selectedEntry.id,
      data: {
        ...data,
        keywords: keywordsInput.split(',').map(k => k.trim()).filter(Boolean),
        intents: intentsInput.split(',').map(i => i.trim()).filter(Boolean),
      },
    });
  };
  
  const handleDelete = () => {
    if (!selectedEntry) return;
    deleteMutation.mutate(selectedEntry.id);
  };
  
  const handleRollback = (version: number) => {
    if (!selectedEntry) return;
    rollbackMutation.mutate({ id: selectedEntry.id, version });
  };
  
  const openCreateDialog = () => {
    reset();
    setKeywordsInput('');
    setIntentsInput('');
    setShowCreateDialog(true);
  };
  
  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold">AI Knowledge Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage knowledge base entries for AI-assisted support responses
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Entry
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Entry List */}
        <div className="w-[400px] border-r flex flex-col">
          {/* Search & Filters */}
          <div className="p-4 space-y-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="text-sm text-muted-foreground">
              {entries.length} entries found
            </div>
          </div>
          
          {/* Entry List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No entries found</p>
                  <Button variant="link" onClick={openCreateDialog}>
                    Create your first entry
                  </Button>
                </div>
              ) : (
                entries.map((entry) => (
                  <Card
                    key={entry.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/50',
                      selectedEntry?.id === entry.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{entry.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {entry.content.substring(0, 100)}...
                          </p>
                        </div>
                        {!entry.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(entry.category)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{entry.version}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.usage_count} uses
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Right Panel - Entry Details */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedEntry ? (
            <>
              {/* Entry Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-xl font-semibold">{selectedEntry.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Last updated {new Date(selectedEntry.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowHistoryDialog(true)}
                  >
                    <History className="w-4 h-4 mr-1" />
                    History
                  </Button>
                  {editMode ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditMode(false);
                          handleSelectEntry(selectedEntry);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSubmit(handleUpdate)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditMode(true)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Entry Content */}
              <ScrollArea className="flex-1">
                <form className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      {editMode ? (
                        <Input {...register('title', { required: true })} />
                      ) : (
                        <p className="p-2 bg-muted rounded">{selectedEntry.title}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Category</Label>
                      {editMode ? (
                        <Select 
                          value={watch('category')} 
                          onValueChange={(v) => setValue('category', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="p-2 bg-muted rounded">
                          {getCategoryLabel(selectedEntry.category)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Content</Label>
                    {editMode ? (
                      <Textarea 
                        {...register('content', { required: true })}
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="p-4 bg-muted rounded min-h-[200px] whitespace-pre-wrap">
                        {selectedEntry.content}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Keywords</Label>
                      {editMode ? (
                        <Input
                          value={keywordsInput}
                          onChange={(e) => setKeywordsInput(e.target.value)}
                          placeholder="Comma-separated keywords"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.keywords.map((keyword, i) => (
                            <Badge key={i} variant="secondary">{keyword}</Badge>
                          ))}
                          {selectedEntry.keywords.length === 0 && (
                            <span className="text-sm text-muted-foreground">No keywords</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Keywords help match this entry to user queries
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Intents</Label>
                      {editMode ? (
                        <Input
                          value={intentsInput}
                          onChange={(e) => setIntentsInput(e.target.value)}
                          placeholder="Comma-separated intents"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.intents.map((intent, i) => (
                            <Badge key={i} variant="outline">{intent}</Badge>
                          ))}
                          {selectedEntry.intents.length === 0 && (
                            <span className="text-sm text-muted-foreground">No intents</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Intents define user actions this entry addresses
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Active</Label>
                        <p className="text-xs text-muted-foreground">
                          Include in AI responses
                        </p>
                      </div>
                      {editMode ? (
                        <Switch
                          checked={watch('is_active')}
                          onCheckedChange={(v) => setValue('is_active', v)}
                        />
                      ) : (
                        <Badge variant={selectedEntry.is_active ? 'default' : 'secondary'}>
                          {selectedEntry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      {editMode ? (
                        <Select 
                          value={String(watch('priority'))} 
                          onValueChange={(v) => setValue('priority', Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((p) => (
                              <SelectItem key={p} value={String(p)}>
                                {p} - {p === 1 ? 'Highest' : p === 5 ? 'Lowest' : 'Normal'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="p-2 bg-muted rounded">{selectedEntry.priority}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Usage Count</Label>
                      <p className="p-2 bg-muted rounded">{selectedEntry.usage_count} times</p>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(selectedEntry.created_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Version:</span>{' '}
                      {selectedEntry.version}
                    </div>
                    <div>
                      <span className="font-medium">Updated:</span>{' '}
                      {new Date(selectedEntry.updated_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Created by:</span>{' '}
                      {selectedEntry.created_by}
                    </div>
                  </div>
                </form>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-1">Select an entry</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on an entry to view and edit details
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Entry
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Knowledge Entry</DialogTitle>
            <DialogDescription>
              Add a new entry to the AI knowledge base
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input 
                  {...register('title', { required: true })}
                  placeholder="Entry title"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select 
                  value={watch('category')} 
                  onValueChange={(v) => setValue('category', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea 
                {...register('content', { required: true })}
                placeholder="Knowledge base content..."
                className="min-h-[150px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Keywords</Label>
                <Input
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="pricing, billing, subscription"
                />
              </div>
              <div className="space-y-2">
                <Label>Intents</Label>
                <Input
                  value={intentsInput}
                  onChange={(e) => setIntentsInput(e.target.value)}
                  placeholder="cancel_subscription, upgrade_plan"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={watch('is_active')}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label>Active immediately</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>Priority:</Label>
                <Select 
                  value={String(watch('priority'))} 
                  onValueChange={(v) => setValue('priority', Number(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Entry'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedEntry?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this entry
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Restore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No version history available
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((version: any) => (
                    <TableRow key={version.version}>
                      <TableCell>
                        <Badge variant="outline">v{version.version}</Badge>
                      </TableCell>
                      <TableCell>{version.changed_by}</TableCell>
                      <TableCell>
                        {new Date(version.changed_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{version.action}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {version.version !== selectedEntry?.version && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRollback(version.version)}
                            disabled={rollbackMutation.isPending}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        )}
                        {version.version === selectedEntry?.version && (
                          <Badge>Current</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
