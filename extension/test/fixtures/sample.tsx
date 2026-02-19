import React, { useContext, useCallback, useMemo } from "react";

const AppContext = React.createContext({});

// SHOULD FLAG: inline object prop
const BadInlineObject = () => {
  return <div style={{ color: "red", padding: 10 }} />;
};

// SHOULD FLAG: inline function prop
const BadInlineFunction = () => {
  return <button onClick={() => console.log("clicked")}>Click</button>;
};

// SHOULD FLAG: index key in .map()
const BadKeys = ({ items }: { items: string[] }) => {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};

// SHOULD FLAG: missing React.memo (accepts props, stateless, returns JSX)
const PureChild = (props: { name: string }) => {
  return <span>{props.name}</span>;
};

// SHOULD FLAG: useMemo without dependency array
const BadMemo = () => {
  const value = useMemo(() => expensive());
  return <div>{value}</div>;
};

// SHOULD FLAG: unstable object in deps
const BadDeps = () => {
  const value = useMemo(() => "x", [{ a: 1 }]);
  return <div>{value}</div>;
};

// SHOULD FLAG: inline object in Context.Provider value
const BadProvider = ({ children }: { children: React.ReactNode }) => {
  const user = "test";
  return <AppContext.Provider value={{ user }}>{children}</AppContext.Provider>;
};

// SHOULD FLAG: broad context consumer (no destructuring)
const BadConsumer = () => {
  const ctx = useContext(AppContext);
  return <div>{(ctx as any).theme}</div>;
};

// SHOULD NOT FLAG: properly memoized
const GoodComponent = React.memo(({ name }: { name: string }) => {
  const handleClick = useCallback(() => console.log(name), [name]);
  const style = useMemo(() => ({ color: "blue" }), []);
  return (
    <button onClick={handleClick} style={style}>
      {name}
    </button>
  );
});

// SHOULD NOT FLAG: destructured context
const GoodConsumer = () => {
  const { theme } = useContext(AppContext) as any;
  return <div>{theme}</div>;
};

function expensive() {
  return 42;
}

export {
  BadInlineObject,
  BadInlineFunction,
  BadKeys,
  PureChild,
  BadMemo,
  BadDeps,
  BadProvider,
  BadConsumer,
  GoodComponent,
  GoodConsumer,
};
