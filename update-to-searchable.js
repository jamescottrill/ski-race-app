#!/usr/bin/env node

const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/renderer/pages/race/EditRacePageNew.js', 'utf8');

// List of fields to update
const fieldsToUpdate = [
  'tech_delegate',
  'referee', 
  'assistant_referee',
  'start_referee',
  'finish_referee',
  'course_setter',
  'forerunner_1',
  'forerunner_2',
  'forerunner_3'
];

// Replace each SimpleSelect for person fields with SearchableSelect
fieldsToUpdate.forEach(field => {
  const labelText = field.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  const placeholderText = field.startsWith('forerunner') 
    ? `Select ${labelText.replace('Forerunner ', 'Forerunner ')}`
    : `Select ${labelText}`;

  // Create regex to match the SimpleSelect block for this field
  const regex = new RegExp(
    `<Label htmlFor="${field}">[^<]+</Label>\\s*<SimpleSelect[^>]*name="${field}"[^>]*>[\\s\\S]*?</SimpleSelect>`,
    'g'
  );

  const replacement = `<Label htmlFor="${field}">${labelText}</Label>
                    <SearchableSelect
                      id="${field}"
                      name="${field}"
                      value={formData.${field}}
                      onChange={(value) => handleInputChange({ target: { name: '${field}', value } })}
                      options={people.map(person => ({
                        value: person.id.toString(),
                        label: \`\${person.last_name}, \${person.first_name}\`
                      }))}
                      placeholder="${placeholderText}"
                      searchPlaceholder="Search people..."
                      emptyText="No person found"
                    />`;

  content = content.replace(regex, replacement);
});

// Write the updated content back
fs.writeFileSync('src/renderer/pages/race/EditRacePageNew.js', content);
console.log('Updated all person fields to use SearchableSelect');