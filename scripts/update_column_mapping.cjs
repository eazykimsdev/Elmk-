const fs = require('fs');
let code = fs.readFileSync('src/app/import/components/column-mapping.tsx', 'utf8');

code = code.replace(
  'import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"',
  `import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"`
);

const selectRegex = /<NativeSelect[\s\S]*?<\/NativeSelect>/;
const replacement = `<Select
                value={current ?? UNMAPPED}
                onValueChange={(val) =>
                  onChange(index, val === UNMAPPED ? null : (val as FieldKey))
                }
              >
                <SelectTrigger className="w-44 h-8 text-xs bg-[#1A1C22] border-[var(--border)]">
                  <SelectValue placeholder="Map field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNMAPPED}>Do not import</SelectItem>
                  {FIELDS.filter((entry) => entry.key === current || !taken.has(entry.key)).map(
                    (entry) => (
                      <SelectItem key={entry.key} value={entry.key}>
                        {entry.label}
                        {entry.required ? " (required)" : ""}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>`;

if (selectRegex.test(code)) {
  code = code.replace(selectRegex, replacement);
  fs.writeFileSync('src/app/import/components/column-mapping.tsx', code, 'utf8');
  console.log('Replaced column-mapping select!');
} else {
  console.error('Regex not matched');
}

