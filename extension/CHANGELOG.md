# Changelog

## 0.2.0

- Repositioned as a detection tool: "signals, not mandates"
- Detector messages now explain *when* a pattern matters, not just that it exists
- Added quick fixes to `derivedState` (wrap in useMemo) and `unstableDeps` (add dependency array)
- Updated marketplace description, README, and website copy
- Removed batch "Fix All" command to align with review-first philosophy

## 0.1.0 — Initial Release

- 9 pattern detectors across two tiers
  - **Tier 1:** Inline objects, inline functions, missing React.memo, array index keys, unstable hook deps, broad context consumption
  - **Tier 2:** Unmemoized derived state, props drilling, state lifted too high
- Inline diagnostics with configurable severity
- CodeLens render risk scores above each component
- Quick-fix Code Actions (wrap with useMemo/useCallback)
- Component Tree sidebar in the activity bar
- Per-pattern enable/disable configuration
