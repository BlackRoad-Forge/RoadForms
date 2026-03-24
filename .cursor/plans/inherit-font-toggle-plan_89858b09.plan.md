---
name: inherit-font-toggle-plan
overview: Add an easy “inherit host page font” design using the existing `fontFamily` styling field, mapped to CSS variable fallback behavior in the SDK. Keep it backward-compatible and minimize schema churn by avoiding new persisted fields.
todos:
  - id: sdk-font-fallback
    content: Switch SDK preflight font-family to var(--fb-font-family, inherit) in surveys preflight CSS.
    status: pending
  - id: inject-font-variable
    content: Wire styling.fontFamily into addCustomThemeToDom to emit --fb-font-family only when set.
    status: pending
  - id: editor-toggle-ui
    content: Add inherit-font toggle + conditional font stack input in shared FormStylingSettings component.
    status: pending
  - id: i18n-keys
    content: Add English translation keys for new toggle and font stack field text.
    status: pending
  - id: tests
    content: Add/extend tests for CSS variable emission and UI toggle-to-fontFamily mapping.
    status: pending
  - id: manual-verification
    content: Validate inline/modal behavior with host-font inherit ON and explicit stack OFF.
    status: pending
isProject: false
---

# Inherit Font Toggle (Easy Design)

## Goal

Implement a simple styling toggle that lets users choose whether surveys inherit the host page font, using existing `fontFamily` (no new DB/schema field).

## Implementation Approach

- Represent toggle state via `fontFamily`:
  - **Inherit ON**: `fontFamily` is `null`/unset
  - **Inherit OFF**: `fontFamily` contains a font stack string
- Make SDK preflight use a CSS variable fallback:
  - `font-family: var(--fb-font-family, inherit);`
- Inject `--fb-font-family` only when `styling.fontFamily` is set.

## Changes by Area

- **SDK base font behavior**
  - Update [packages/surveys/src/styles/preflight.css](packages/surveys/src/styles/preflight.css) to replace hardcoded Inter stack with variable + inherit fallback.
- **Theme/style variable injection**
  - Update [packages/surveys/src/lib/styles.ts](packages/surveys/src/lib/styles.ts) to append `--fb-font-family` from `styling.fontFamily` when present.
- **Styling editor UX (workspace + survey reuse)**
  - Extend [apps/web/modules/survey/editor/components/form-styling-settings.tsx](apps/web/modules/survey/editor/components/form-styling-settings.tsx):
    - Add a toggle control for “Inherit font from host page”.
    - When disabled, show a text field for font stack (bind to `fontFamily`).
    - Keep this inside advanced styling section to reduce UI noise.
  - Because workspace theme and survey styling both reuse this component, this covers both entry points (including [apps/web/modules/projects/settings/look/components/theme-styling.tsx](apps/web/modules/projects/settings/look/components/theme-styling.tsx) and survey editor views) without duplicating UI code.
- **Defaults and compatibility**
  - Ensure defaults continue to behave as inherit when `fontFamily` is absent (no mandatory updates to defaults object needed).
  - Verify existing saved stylings without `fontFamily` continue to render unchanged except adopting host font (intended behavior).
- **Translations**
  - Add new i18n keys in [apps/web/locales/en-US.json](apps/web/locales/en-US.json) for the toggle label/description and custom-font input label/description.

## Testing Plan

- Extend [packages/surveys/src/lib/styles.test.ts](packages/surveys/src/lib/styles.test.ts):
  - Assert `--fb-font-family` is emitted when `fontFamily` is provided.
  - Assert it is omitted when `fontFamily` is null/undefined.
- Add/adjust editor component tests (where existing pattern for form controls exists) to verify toggle behavior updates `fontFamily` correctly.
- Manual verification:
  - Host page with a distinctive font: confirm survey inherits when toggle ON.
  - Toggle OFF + custom stack: confirm survey uses configured stack.
  - Regression check in modal and inline renders.

## Risks and Mitigations

- **Risk:** Host font may be unavailable in some contexts.
  - **Mitigation:** Custom stack path remains available when inherit is OFF.
- **Risk:** Confusion between workspace and survey-level overrides.
  - **Mitigation:** Keep existing overwrite semantics; only map toggle to `fontFamily` value at the currently edited scope.
- **Risk:** Iframe embeds cannot inherit outer-page font.
  - **Mitigation:** Document that iframe use requires explicit font stack (toggle OFF).

## Validation Commands (post-implementation)

- `pnpm test --filter @formbricks/surveys`
- `pnpm lint`
- Optional manual check in a host app with a non-default font to verify inheritance behavior.
