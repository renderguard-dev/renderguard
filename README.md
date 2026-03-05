# RenderGuard

**Surface React performance patterns worth reviewing — right in your editor.**

RenderGuard is a VS Code / Cursor extension that statically analyzes your React components and highlights patterns that *can* lead to performance issues. It's not a linter that demands you fix everything — it's a second pair of eyes that helps you make informed decisions about when memoization and optimization are actually worth the tradeoff.

## Philosophy

Not every re-render is a problem. React is designed to re-render, and most re-renders are cheap — React compares the output and skips the DOM commit if nothing changed. Sprinkling `useMemo` and `useCallback` everywhere can actually *add* overhead rather than remove it.

**RenderGuard doesn't tell you to fix everything it flags.** Instead, it surfaces patterns that are *worth a second look* — places where performance could degrade at scale, in hot paths, or with expensive computations. You decide what's worth optimizing based on your app's real-world constraints.

**When RenderGuard findings matter most:**
- Components that render large lists or complex trees
- Hot paths that re-render on every keystroke or animation frame
- Expensive computations (sorting, filtering, transforming large datasets) in the render body
- Context providers with many consumers where value stability matters
- Components wrapped in `React.memo` that receive unstable props (this is where inline objects/functions *actually* break memoization)

**When you can safely ignore a finding:**
- Simple components with cheap render output
- Inline handlers on leaf components that aren't wrapped in `React.memo`
- Small derived computations on small datasets
- Early-stage prototyping where readability matters more than optimization

## What It Detects

RenderGuard ships with 9 pattern detectors across two tiers. Each detection is a *signal*, not a mandate.

### Tier 1 — Per-Statement Analysis

#### Inline Objects & Arrays as Props
```jsx
// Flagged: new reference every render — matters if Child uses React.memo
<Child style={{ color: 'red' }} />

// Consider when the child is memoized or the object is expensive to create
const style = useMemo(() => ({ color: 'red' }), []);
<Child style={style} />
```

#### Inline Functions as Props
```jsx
// Flagged: new function reference every render
// Often harmless — only matters if the child is wrapped in React.memo
<Button onClick={() => handleClick(id)} />

// Worth it when Button is memoized and this prevents unnecessary child re-renders
const onClick = useCallback(() => handleClick(id), [id]);
<Button onClick={onClick} />
```

#### Missing React.memo
```jsx
// Flagged: re-renders when parent re-renders, even if props haven't changed
// Often fine for simple components — React's diffing is fast
const UserCard = ({ name }) => <span>{name}</span>;

// Worth it for expensive components or those deep in a frequently-updating tree
const UserCard = React.memo(({ name }) => <span>{name}</span>);
```

#### Array Index as Key
```jsx
// Flagged: causes unnecessary remounts when list order changes
items.map((item, index) => <Item key={index} />)

// Preferred: stable identity prevents remounting
items.map((item) => <Item key={item.id} />)
```

#### Missing or Unstable Hook Dependencies
```jsx
// Flagged: missing deps defeats memoization entirely
const value = useMemo(() => compute(a, b));

// Flagged: object literal in deps re-triggers every render
const result = useMemo(() => x, [{ a: 1 }]);

// Correct
const value = useMemo(() => compute(a, b), [a, b]);
```

#### Broad Context Consumption
```jsx
// Flagged: inline object in Provider causes all consumers to re-render
<AppContext.Provider value={{ user, theme }}>

// Flagged: subscribes to ALL context changes, even ones you don't use
const ctx = useContext(AppContext);

// Better: stable value + selective destructuring
const value = useMemo(() => ({ user, theme }), [user, theme]);
<AppContext.Provider value={value}>
const { theme } = useContext(AppContext);
```

### Tier 2 — Data Flow Analysis

#### Unmemoized Derived State
```jsx
// Flagged: recalculates on every render — costly with large datasets
const filtered = items.filter(i => i.active);
const sorted = [...data].sort((a, b) => a - b);

// Worth it when the dataset is large or the computation is expensive
const filtered = useMemo(() => items.filter(i => i.active), [items]);
```

#### Props Drilling
```jsx
// Flagged: "theme" passes through without being used — consider Context
const Layout = ({ theme }) => <Sidebar theme={theme} />;

// Not flagged: "theme" is used in own logic
const Layout = ({ theme }) => <div className={theme}><Sidebar /></div>;
```

#### State Lifted Too High
```jsx
// Flagged: state only used by one child — moving it down reduces parent re-renders
const Parent = () => {
  const [count, setCount] = useState(0);
  return <Counter count={count} setCount={setCount} />;
};
```

## Features

- **Diagnostics** — Inline hints for detected patterns, with hover details explaining when it matters
- **CodeLens** — Pattern density score above each component for at-a-glance triage
- **Quick Fixes** — One-click `useMemo` and `useCallback` wrapping when you decide it's warranted
- **Component Tree Sidebar** — Activity bar panel showing all components, grouped by pattern density
- **Fully Configurable** — Disable any detector you disagree with. Set severity to hint if you want gentle nudges instead of warnings
- **Fast** — Static AST analysis via Babel, no type-checking overhead, debounced on keystrokes

## Installation

### From Marketplace

Search for **"RenderGuard"** in the VS Code / Cursor extensions panel, or visit the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=renderguard-dev.renderguard). For Cursor, you can also install from [Open VSX](https://open-vsx.org/extension/renderguard-dev/renderguard).

### From Source (Development)

```bash
git clone https://github.com/renderguard-dev/renderguard.git
cd renderguard/extension
npm install
npm run build
```

Then press **F5** in VS Code / Cursor to launch the Extension Development Host.

## Configuration

All settings live under `renderguard.*` in your VS Code / Cursor settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `renderguard.enable` | `boolean` | `true` | Enable/disable all diagnostics |
| `renderguard.severity` | `string` | `"warning"` | Severity level: `error`, `warning`, `information`, `hint` |
| `renderguard.enableCodeLens` | `boolean` | `true` | Show pattern density scores above components |
| `renderguard.patterns` | `object` | all `true` | Toggle individual detectors |

### Example: disable patterns you don't find useful

```json
{
  "renderguard.patterns": {
    "inlineObjects": true,
    "inlineFunctions": false,
    "missingMemo": false,
    "unstableKeys": true,
    "unstableDeps": true,
    "broadContext": true,
    "derivedState": true,
    "propsDrilling": true,
    "liftedState": true
  }
}
```

**Tip:** If you find a detector too noisy for your codebase, set `renderguard.severity` to `"hint"` for unobtrusive inline annotations, or disable individual patterns entirely.

## Architecture

```
renderguard/
├── extension/                  VS Code / Cursor extension
│   ├── src/
│   │   ├── extension.ts        Entry point — VS Code lifecycle
│   │   ├── analyzer.ts         Coordinates detectors, groups by component
│   │   ├── codelens.ts         CodeLens — pattern density above components
│   │   ├── codeactions.ts      Quick-fix Code Actions + Fix All
│   │   ├── treeview.ts         Component Tree sidebar panel
│   │   ├── types.ts            Shared interfaces
│   │   ├── utils/
│   │   │   ├── ast.ts          Babel parser wrapper (JSX + TypeScript)
│   │   │   └── diagnostics.ts  Severity mapping, scoring
│   │   └── patterns/
│   │       ├── inlineObjects.ts    Inline object/array literals as props
│   │       ├── inlineFunctions.ts  Inline arrow functions as props
│   │       ├── missingMemo.ts      Components missing React.memo
│   │       ├── unstableKeys.ts     Array index used as key
│   │       ├── unstableDeps.ts     Missing/unstable hook deps
│   │       ├── broadContext.ts     Inline Provider values, broad useContext
│   │       ├── derivedState.ts     Unmemoized .filter()/.sort()/etc.
│   │       ├── propsDrilling.ts    Props forwarded without own use
│   │       └── liftedState.ts      useState passed to single child
│   └── test/                   82 tests across 10 test files
└── website/                    Product website
```

Each pattern detector implements a simple interface:

```typescript
interface PatternDetector {
  id: PatternId;
  detect(ast: File, document: TextDocument): RenderIssue[];
}
```

Adding a new detector is as simple as creating a file in `extension/src/patterns/`, implementing the interface, and registering it in `extension/src/patterns/index.ts`.

## Roadmap

- [x] **Tier 1 detectors** — Inline objects, inline functions, missing memo, unstable keys, unstable deps, broad context
- [x] **Tier 2 detectors** — Derived state not memoized, props drilling, state lifted too high
- [x] **Component tree sidebar** — Activity bar panel with pattern density per component
- [ ] **CI mode** — Run as a CLI / ESLint plugin for pre-commit and CI pipeline checks
- [ ] **Configurable thresholds** — Set minimum dataset size or component complexity for certain detectors
- [ ] **Render vs. commit awareness** — Distinguish between cheap re-renders and costly DOM commits

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
