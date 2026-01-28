import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn, Button } from '../design-system';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../design-system/components/primitives/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../design-system/components/primitives/Popover';
import PersonModalNew from './PersonModalNew';

export default function PersonSelect({
  value,
  onChange,
  label,
  placeholder = 'Select a person...',
  className,
  name,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [people, setPeople] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const fetchPeople = async () => {
    try {
      const result = await window.api.select(
        `SELECT id, first_name, last_name, title
         FROM people
         ORDER BY last_name, first_name`,
        []
      );
      setPeople(result);
    } catch (err) {
      console.error('Failed to fetch people:', err);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  useEffect(() => {
    if (value && people.length > 0) {
      const person = people.find((p) => p.id === value);
      setSelectedPerson(person || null);
    } else {
      setSelectedPerson(null);
    }
  }, [value, people]);

  const formatPersonLabel = (person) => {
    const parts = [];
    if (person.title) parts.push(person.title);
    parts.push(person.last_name?.toUpperCase() || '');
    parts.push(person.first_name || '');
    return parts.filter(Boolean).join(' ');
  };

  const handleSelect = (personId) => {
    onChange?.(personId);
    setOpen(false);
    setSearchValue('');
  };

  const handleAddPerson = (newPerson) => {
    fetchPeople();
    onChange?.(newPerson.id);
    setShowAddModal(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(null);
    setSearchValue('');
  };

  const filteredPeople = people.filter((person) => {
    const searchLower = searchValue.toLowerCase();
    const fullName = `${person.title || ''} ${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
    return fullName.includes(searchLower);
  });

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-neutral-500'
            )}
          >
            {selectedPerson ? formatPersonLabel(selectedPerson) : placeholder}
            <div className="flex items-center ml-2">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
                  className="h-4 w-4 rounded-sm hover:bg-neutral-200 flex items-center justify-center mr-1"
                >
                  <X className="h-3 w-3 opacity-50 hover:opacity-100" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search people..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-9"
            />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowAddModal(true);
                  }}
                  className="text-primary-600 font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Person
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                {filteredPeople.length === 0 && (
                  <div className="py-6 text-center text-sm text-neutral-500">
                    No person found.
                  </div>
                )}
                {filteredPeople.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={formatPersonLabel(person)}
                    onSelect={() => handleSelect(person.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === person.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {formatPersonLabel(person)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {name && <input type="hidden" name={name} value={value || ''} />}
      </Popover>

      <PersonModalNew
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddPerson}
      />
    </div>
  );
}
