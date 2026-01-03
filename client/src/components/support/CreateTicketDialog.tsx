/**
 * Create Ticket Dialog Component
 * Modal form for creating new support tickets
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  CreditCard,
  Package,
  Bug,
  Lightbulb,
  User,
  Download,
  Plug,
  Zap,
  Shield,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateTicket, useTicketCategories, useTicketPriorities } from '@/hooks/useSupport';
import { useToast } from '@/hooks/use-toast';
import { CreateTicketRequest, TicketCategory, TicketPriority } from '@/types/support';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (ticketId: string) => void;
}

const categoryIcons: Record<string, any> = {
  billing_payment: CreditCard,
  subscription_plan: Package,
  technical_bug: Bug,
  feature_request: Lightbulb,
  account_access: User,
  data_export: Download,
  integration_api: Plug,
  performance: Zap,
  security: Shield,
  onboarding: BookOpen,
  general: HelpCircle,
};

export function CreateTicketDialog({ open, onOpenChange, onSuccess }: CreateTicketDialogProps) {
  const [step, setStep] = useState<'category' | 'details'>('category');
  const { toast } = useToast();
  
  const { data: categories = [] } = useTicketCategories();
  const { data: priorities = [] } = useTicketPriorities();
  const createMutation = useCreateTicket();
  
  const form = useForm<CreateTicketRequest>({
    defaultValues: {
      subject: '',
      description: '',
      category: undefined,
      priority: 'medium',
    },
  });
  
  const selectedCategory = form.watch('category');
  
  const handleCategorySelect = (category: TicketCategory) => {
    form.setValue('category', category);
    setStep('details');
  };
  
  const handleSubmit = async (data: CreateTicketRequest) => {
    try {
      const result = await createMutation.mutateAsync(data);
      toast({
        title: 'Ticket Created',
        description: `Your ticket #${result.ticket?.ticket_number || result.data?.ticket_number || 'TKT'} has been submitted.`,
      });
      form.reset();
      setStep('category');
      onOpenChange(false);
      onSuccess?.(result.ticket?.id || result.data?.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create ticket',
        variant: 'destructive',
      });
    }
  };
  
  const handleBack = () => {
    setStep('category');
  };
  
  const handleClose = () => {
    form.reset();
    setStep('category');
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'category' ? 'What do you need help with?' : 'Describe your issue'}
          </DialogTitle>
          <DialogDescription>
            {step === 'category' 
              ? 'Select a category that best matches your issue'
              : 'Provide details so we can help you faster'
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            {step === 'category' ? (
              /* Category Selection */
              <div className="grid grid-cols-2 gap-3 py-4">
                {categories.map((category: any) => {
                  const Icon = categoryIcons[category.code] || HelpCircle;
                  return (
                    <button
                      key={category.code}
                      type="button"
                      onClick={() => handleCategorySelect(category.code)}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border text-left transition-all',
                        'hover:border-primary hover:bg-primary/5',
                        selectedCategory === category.code && 'border-primary bg-primary/5'
                      )}
                    >
                      <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{category.name}</div>
                        {category.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {category.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Details Form */
              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="subject"
                  rules={{ required: 'Subject is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Brief summary of your issue" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  rules={{ 
                    required: 'Description is required',
                    minLength: { value: 20, message: 'Please provide more details (at least 20 characters)' }
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, etc."
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        The more details you provide, the faster we can help.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-wrap gap-4"
                        >
                          {priorities.map((priority: any) => (
                            <div key={priority.code} className="flex items-center space-x-2">
                              <RadioGroupItem 
                                value={priority.code} 
                                id={`priority-${priority.code}`} 
                              />
                              <label 
                                htmlFor={`priority-${priority.code}`}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <span 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: priority.color }}
                                />
                                {priority.name}
                              </label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>
                        Select the priority based on urgency and business impact.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <DialogFooter className="gap-2">
              {step === 'details' && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              {step === 'details' && (
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Submit Ticket'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
