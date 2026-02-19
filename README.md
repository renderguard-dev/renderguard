# RenderGuard

**Detect and fix unnecessary React re-renders — before they ship.**

RenderGuard is a VS Code / Cursor extension that statically analyzes your React codebase and flags components at risk of unnecessary re-renders. No runtime profiling, no manual setup — just open a file and see the issues.

## Why

Unnecessary re-renders are the most common performance problem in React apps. They're easy to introduce, hard to spot in code review, and painful to debug at runtime. Existing tools like React DevTools Profiler and `why-did-you-render` only work at runtime. RenderGuard catches these problems **at development time**, right in your editor.

## What It Detects

### Inline Objects & Arrays as Props
```jsx
// Flagged: new object reference on every render
<Child style={{ color: 'red' }} />
<List items={[1, 2, 3]} />

// Safe
const style = useMemo(() => ({ color: 'red' }), []);
<Child style={style} />
```

### Inline Functions as Props
```jsx
// Flagged: new function reference on every render
<Button onClick={() => handleClick(id)} />

// Safe
const onClick = useCallback(() => handleClick(id), [id]);
<Button onClick={onClick} />
```

### Missing React.memo
```jsx
// Flagged: stateless component re-renders when parent re-renders
const UserCard = (props: { name: string }) => {
  return <span>{props.name}</span>;
};

// Safe
const UserCard = React.memo((props: { name: string }) => {
  return <span>{props.name}</span>;
});
```

### Array Index as Key
```jsx
// Flagged: causes remounts when list order changes
items.map((item, index) => <Item key={index} />)

// Safe
items.map((item) => <Item key={item.id} />)
```

### Missing or Unstable Hook Dependencies
```jsx
// Flagged: missing deps defeats memoization
const value = useMemo(() => compute(a, b));

// Flagged: object literal in deps re-triggers every render
const result = useMemo(() => x, [{ a: 1 }]);

// Safe
const value = useMemo(() => compute(a, b), [a, b]);
```

### Broad Context Consumption
```jsx
// Flagged: inline object in Provider re-renders all consumers
<AppContext.Provider value={{ user, theme }}>

// Flagged: subscribes to ALL context changes
const ctx = useContext(AppContext);

// Safe
const value = useMemo(() => ({ user, theme }), [user, theme]);
<AppContext.Provider value={value}>

// Safe: destructure only what's needed
const { theme } = useContext(AppContext);
```

## Features

- **Diagnostics** — Inline warnings (squiggly underlines) for every detected issue
- **CodeLens** — Render risk score displayed above each component (Low / Medium / High)
- **Quick Fixes** — One-click `useMemo` and `useCallback` wrapping via Code Actions
- **Configurable** — Enable/disable individual patterns, set severity level
- **Fast** — Static AST analysis via Babel, no type-checking overhead, debounced on keystrokes

## Installation

### From Source (Development)

```bash
git clone https://github.com/renderguard-dev/renderguard.git
cd renderguard
npm install
npm run build
```

Then press **F5** in VS Code / Cursor to launch the Extension Development Host.

### From Marketplace

Coming soon.

## Configuration

All settings live under `renderguard.*` in your VS Code / Cursor settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `renderguard.enable` | `boolean` | `true` | Enable/disable all diagnostics |
| `renderguard.severity` | `string` | `"warning"` | Severity level: `error`, `warning`, `information`, `hint` |
| `renderguard.enableCodeLens` | `boolean` | `true` | Show render risk scores above components |
| `renderguard.patterns` | `object` | all `true` | Toggle individual detectors |

### Example: disable a specific pattern

```json
{
  "renderguard.patterns": {
    "inlineObjects": true,
    "inlineFunctions": true,
    "missingMemo": false,
    "unstableKeys": true,
    "unstableDeps": true,
    "broadContext": true
  }
}
```

You can also disable a pattern by clicking the **Quick Fix** on any diagnostic and selecting "Disable this check".

## Architecture

```
src/
├── extension.ts           Entry point — wires up VS Code lifecycle
├── analyzer.ts            Coordinates detectors, groups issues by component
├── codelens.ts            CodeLens provider — risk scores above components
├── codeactions.ts         Quick-fix Code Actions
├── types.ts               Shared interfaces
├── utils/
│   ├── ast.ts             Babel parser wrapper (JSX + TypeScript)
│   └── diagnostics.ts     Severity mapping, risk scoring
└── patterns/
    ├── inlineObjects.ts   Inline object/array literals as props
    ├── inlineFunctions.ts Inline arrow functions as props
    ├── missingMemo.ts     Components missing React.memo
    ├── unstableKeys.ts    Array index used as key
    ├── unstableDeps.ts    Missing/unstable useMemo/useCallback deps
    └── broadContext.ts    Inline Provider values, broad useContext
```

Each pattern detector implements a simple interface:

```typescript
interface PatternDetector {
  id: PatternId;
  detect(ast: File, document: TextDocument): RenderIssue[];
}
```

Adding a new detector is as simple as creating a file in `src/patterns/`, implementing the interface, and registering it in `src/patterns/index.ts`.

## Roadmap

- [ ] **Tier 2 detectors** — State lifted too high, derived state not memoized, props drilling
- [ ] **Component tree view** — Sidebar panel with color-coded re-render risk
- [ ] **Blast radius analysis** — "What re-renders when this state changes?"
- [ ] **CI mode** — Run as a CLI for pre-commit / CI pipeline checks
- [ ] **Auto-fix all** — Batch-fix all issues in a file with one command

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
