import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PartyProfile } from "@shared/schema";

const partyFormSchema = z.object({
  personName: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobileNo: z.string().min(10, "Mobile number must be at least 10 digits"),
  gstNo: z.string().optional(),
  address: z.string().optional(),
});

type PartyFormValues = z.infer<typeof partyFormSchema>;

interface PartyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party?: PartyProfile | null;
  onSave?: (party: PartyProfile) => void;
}

export function PartyFormModal({ open, onOpenChange, party, onSave }: PartyFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!party;

  const form = useForm<PartyFormValues>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      personName: "",
      designation: "",
      companyName: "",
      email: "",
      mobileNo: "",
      gstNo: "",
      address: "",
    },
  });

  useEffect(() => {
    if (party) {
      form.reset({
        personName: party.personName || "",
        designation: party.designation || "",
        companyName: party.companyName || "",
        email: party.email || "",
        mobileNo: party.mobileNo || "",
        gstNo: party.gstNo || "",
        address: party.address || "",
      });
    } else {
      form.reset({
        personName: "",
        designation: "",
        companyName: "",
        email: "",
        mobileNo: "",
        gstNo: "",
        address: "",
      });
    }
  }, [party, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: PartyFormValues) => {
      const response = await apiRequest("POST", "/api/party-profiles", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create party");
      }
      return response.json();
    },
    onSuccess: (newParty) => {
      queryClient.invalidateQueries({ queryKey: ["/api/party-profiles"] });
      toast({ title: "Party created successfully" });
      onSave?.(newParty);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create party", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PartyFormValues) => {
      const response = await apiRequest("PATCH", `/api/party-profiles/${party!.id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update party");
      }
      return response.json();
    },
    onSuccess: (updatedParty) => {
      queryClient.invalidateQueries({ queryKey: ["/api/party-profiles"] });
      toast({ title: "Party updated successfully" });
      onSave?.(updatedParty);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update party", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: PartyFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Party" : "Add New Party"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update party details below." : "Enter party details to add a new party."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="personName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Mr. John Doe" {...field} data-testid="input-party-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="Manager" {...field} data-testid="input-party-designation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Corp" {...field} data-testid="input-party-company" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mobileNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="9876543210" {...field} data-testid="input-party-mobile" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} data-testid="input-party-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstNo"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>GST Number</FormLabel>
                    <FormControl>
                      <Input placeholder="27AABCU9603R1ZM" {...field} data-testid="input-party-gst" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Full address..." 
                        className="resize-none" 
                        rows={2}
                        {...field} 
                        data-testid="input-party-address" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-party"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-save-party"
              >
                {isPending ? "Saving..." : (isEditing ? "Update Party" : "Add Party")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
