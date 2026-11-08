const fs = require('fs');

// 1. DataImportTab.tsx
let dataImport = fs.readFileSync('src/pages/dashboard/DataImportTab.tsx', 'utf8');
if (!dataImport.includes("from '@/components/ui/select'")) {
  dataImport = dataImport.replace(
    "import { Badge } from '@/components/ui/badge';",
    `import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';`
  );
}

const dataImportSelectRegex = /<select[\s\S]*?aria-label=\{`\$\{column\} maps to`\}[\s\S]*?<\/select>/;
const dataImportSelectReplacement = `<Select
                      value={current ?? UNMAPPED}
                      onValueChange={(val) => {
                        const nextVal = val === UNMAPPED ? null : (val as FieldKey);
                        setMapping((prev) => ({ ...prev, [index]: nextVal }));
                      }}
                    >
                      <SelectTrigger className="w-52 h-8 text-xs bg-[#1A1C22] border-[var(--border)]">
                        <SelectValue placeholder="Map field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Do not import (Ignore)</SelectItem>
                        {FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label} {f.required ? '*(Required)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>`;

if (dataImportSelectRegex.test(dataImport)) {
  dataImport = dataImport.replace(dataImportSelectRegex, dataImportSelectReplacement);
  fs.writeFileSync('src/pages/dashboard/DataImportTab.tsx', dataImport, 'utf8');
  console.log('Replaced DataImportTab select');
} else {
  console.log('DataImportTab select regex not matched');
}

// 2. RosterImportSection.tsx
let roster = fs.readFileSync('src/pages/dashboard/RosterImportSection.tsx', 'utf8');
if (!roster.includes("from '@/components/ui/select'")) {
  roster = roster.replace(
    "import { Badge } from '@/components/ui/badge';",
    `import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';`
  );
}

const rosterSelectRegex = /<select[\s\S]*?value=\{newDepartment\}[\s\S]*?<\/select>/;
const rosterSelectReplacement = `<Select
                    value={newDepartment}
                    onValueChange={setNewDepartment}
                  >
                    <SelectTrigger className="w-full h-9 bg-[#1A1C22] border-[var(--border)] text-xs text-[#F4F4F5]">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>`;

if (rosterSelectRegex.test(roster)) {
  roster = roster.replace(rosterSelectRegex, rosterSelectReplacement);
  fs.writeFileSync('src/pages/dashboard/RosterImportSection.tsx', roster, 'utf8');
  console.log('Replaced RosterImportSection select');
} else {
  console.log('RosterImportSection select regex not matched');
}

