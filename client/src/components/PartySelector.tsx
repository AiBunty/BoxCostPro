import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users, Plus, Pencil, Trash2, Check, ChevronsUpDown, Building2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PartyProfile } from "@shared/schema";
import { PartyFormModal } from "./PartyFormModal";

interface PartySelectorProps {
  selectedPartyId: string;
  onSelect: (party: PartyProfile | null) => void;
  disabled?: boolean;
}

export function PartySelector({ selectedPartyId, onSelect, disabled }: PartySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editParty, setEditParty] = useState<PartyProfile | null>(null);
  const { toast } = useToast();

  const { data: parties = [], isLoading } = useQuery<PartyProfile[]>({
    queryKey: ["/api/party-profiles"],
  });

  const deletePartyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/party-profiles/${id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete party");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/party-profiles"] });
      toast({ title: "Party deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Cannot delete party", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const selectedParty = useMemo(() => 
    parties.find(p => p.id === selectedPartyId) || null,
    [parties, selectedPartyId]
  );

  const filteredParties = useMemo(() => {
    if (!search) return parties;
    const term = search.toLowerCase();
    return parties.filter(p => 
      p.personName?.toLowerCase().includes(term) ||
      p.companyName?.toLowerCase().includes(term) ||
      p.mobileNo?.includes(term)
    );
  }, [parties, search]);

  const handleSelect = (party: PartyProfile) => {
    onSelect(party);
    setOpen(false);
    setSearch("");
  };

  const handleDelete = (e: React.MouseEvent, party: PartyProfile) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${party.personName}"?`)) {
      deletePartyMutation.mutate(party.id);
      if (selectedPartyId === party.id) {
        onSelect(null);
      }
    }
  };

  const handleEdit = (e: React.MouseEvent, party: PartyProfile) => {
    e.stopPropagation();
    setEditParty(party);
  };

  const handlePartySaved = (party: PartyProfile) => {
    onSelect(party);
    setShowAddModal(false);
    setEditParty(null);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-10",
              !selectedParty && "text-muted-foreground"
            )}
            disabled={disabled}
            data-testid="button-party-selector"
          >
            {selectedParty ? (
              <div className="flex items-center gap-2 truncate">
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedParty.personName}</span>
                {selectedParty.companyName && (
                  <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
                    {selectedParty.companyName}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Party...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search by name, company, mobile..." 
              value={search}
              onValueChange={setSearch}
              data-testid="input-party-search"
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No party found."}
              </CommandEmpty>
              <CommandGroup heading="Parties">
                {filteredParties.map((party) => (
                  <CommandItem
                    key={party.id}
                    value={party.id}
                    onSelect={() => handleSelect(party)}
                    className="flex items-center justify-between group cursor-pointer"
                    data-testid={`party-option-${party.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selectedPartyId === party.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{party.personName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {party.companyName && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {party.companyName}
                            </span>
                          )}
                          {party.mobileNo && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {party.mobileNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleEdit(e, party)}
                        data-testid={`button-edit-party-${party.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(e, party)}
                        disabled={deletePartyMutation.isPending}
                        data-testid={`button-delete-party-${party.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setShowAddModal(true)}
                  className="cursor-pointer"
                  data-testid="button-add-new-party"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Party
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <PartyFormModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSave={handlePartySaved}
      />

      <PartyFormModal
        open={!!editParty}
        onOpenChange={(open: boolean) => !open && setEditParty(null)}
        party={editParty}
        onSave={handlePartySaved}
      />
    </>
  );
}
