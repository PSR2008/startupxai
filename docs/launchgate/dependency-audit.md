# Phase 1 dependency audit - 2026-10-11

Target: no **unassessed** critical/high exposure. This is not a zero-vulnerability declaration. `npm audit` still exits 1; none of these findings are hidden or declared harmless.

Before: 19 affected package entries (1 critical, 15 high, 3 moderate).
After compatible updates: 11 entries (0 critical, 8 high, 3 moderate). Counts include dependency-chain metapackages and are not counts of independent exploits.

## Reviewed changes

Next.js moved from 15.5.22 and eslint-config-next from 15.5.15 to aligned 15.5.27 versions, retaining the existing major version and React peer compatibility. Next advisories [Windows RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36), [AVIF RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [cache poisoning](https://github.com/advisories/GHSA-4jqv-mc3x-m676) and [SSG/ISR poisoning](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) affect the old locked version; 15.5.27 is outside their reported vulnerable ranges. Windows hosting and configured AVIF optimization made dismissal inappropriate.

Then `npm update` targeted axios, @humanfs/node, baseline-browser-mapping, browserslist, js-yaml, nanoid, source-map-js, brace-expansion, postcss-selector-parser and eslint within their existing dependency constraints. No forced audit fix, major toolchain migration, arbitrary override or lockfile suppression was used. Full typecheck/lint/test/build passed after the Next family and again after the compatible transitive updates. ESLint 9.39.5 emits an upstream support deprecation; an ESLint 10/config migration remains future toolchain work.

Sharp was subsequently updated from 0.34.5 to 0.35.5 after inspecting Next 15.5.27 optionalDependencies: it explicitly permits `^0.34.3 || ^0.35.4`. Sharp requires Node >=20.9, compatible with Node 24.19. The old image decoder findings ([libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [libheif](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)) are absent from the final audit. Native AVIF/WebP/PNG encode-resize-decode round trips pass on Windows; the full root toolchain is rerun after this family upgrade. Linux-native validation awaits GitHub CI.

| Package path | Before | After |
| --- | --- | --- |
| `node_modules/@emnapi/runtime` | 1.9.2 | 1.11.3 |
| `node_modules/@eslint/eslintrc` | 3.3.5 | 3.3.7 |
| `node_modules/@eslint/js` | 9.39.4 | 9.39.5 |
| `node_modules/@humanfs/core` | 0.19.1 | 0.19.2 |
| `node_modules/@humanfs/node` | 0.16.7 | 0.16.8 |
| `node_modules/@img/sharp-darwin-arm64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-darwin-x64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-libvips-darwin-arm64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-darwin-x64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-arm` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-arm64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-ppc64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-riscv64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-s390x` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linux-x64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linuxmusl-arm64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-libvips-linuxmusl-x64` | 1.2.4 | 1.3.4 |
| `node_modules/@img/sharp-linux-arm` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linux-arm64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linux-ppc64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linux-riscv64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linux-s390x` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linux-x64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linuxmusl-arm64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-linuxmusl-x64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-wasm32` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-win32-arm64` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-win32-ia32` | 0.34.5 | 0.35.5 |
| `node_modules/@img/sharp-win32-x64` | 0.34.5 | 0.35.5 |
| `node_modules/@next/env` | 15.5.22 | 15.5.27 |
| `node_modules/@next/eslint-plugin-next` | 15.5.15 | 15.5.27 |
| `node_modules/@next/swc-darwin-arm64` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-darwin-x64` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-linux-arm64-gnu` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-linux-arm64-musl` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-linux-x64-gnu` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-linux-x64-musl` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-win32-arm64-msvc` | 15.5.22 | 15.5.27 |
| `node_modules/@next/swc-win32-x64-msvc` | 15.5.22 | 15.5.27 |
| `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion` | 5.0.9 | 5.0.12 |
| `node_modules/acorn` | 8.16.0 | 8.19.0 |
| `node_modules/ajv` | 6.14.0 | 6.15.0 |
| `node_modules/axios` | 1.19.0 | 1.20.0 |
| `node_modules/baseline-browser-mapping` | 2.10.17 | 2.11.28 |
| `node_modules/brace-expansion` | 1.1.18 | 1.1.21 |
| `node_modules/browserslist` | 4.28.2 | 4.29.3 |
| `node_modules/caniuse-lite` | 1.0.30001787 | 1.0.30001815 |
| `node_modules/electron-to-chromium` | 1.5.335 | 1.5.452 |
| `node_modules/eslint` | 9.39.4 | 9.39.5 |
| `node_modules/eslint-config-next` | 15.5.15 | 15.5.27 |
| `node_modules/js-yaml` | 4.3.1 | 4.3.2 |
| `node_modules/nanoid` | 3.3.16 | 3.3.20 |
| `node_modules/next` | 15.5.22 | 15.5.27 |
| `node_modules/node-releases` | 2.0.37 | 2.0.58 |
| `node_modules/postcss-selector-parser` | 6.1.2 | 6.1.4 |
| `node_modules/semver` | 7.7.4 | 7.8.5 |
| `node_modules/sharp` | 0.34.5 | 0.35.5 |
| `node_modules/source-map-js` | 1.2.1 | 1.2.2 |
| `node_modules/update-browserslist-db` | 1.2.3 | 1.3.4 |

## Remaining high and moderate findings

The following inventory comes from the actual after-update audit. Direct means declared by the root application; inherited entries name their dependency chain. Every advisory URL and affected package is retained below.

### @next/eslint-plugin-next - high (transitive)

- Inherited via `fast-glob`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### braces - high (transitive)

- [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); affected range `<=3.0.3`.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### chokidar - high (transitive)

- Inherited via `braces`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### eslint-config-next - high (direct)

- Inherited via `@next/eslint-plugin-next`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### fast-glob - high (transitive)

- Inherited via `micromatch`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### micromatch - high (transitive)

- Inherited via `braces`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.
### next - moderate (direct)

- Inherited via `postcss`. See that package assessment below.

Execution path: Next pins its own PostCSS 8.4.31 for CSS compilation; the root newer PostCSS does not replace it. Crafted sourceMappingURL/CSS input can trigger the reported file-read/XSS paths during processing. Source CSS is checked-in today, but PR/build input is not a security boundary. Remediation: review a Next/PostCSS-compatible patch or Next 16 migration with full build/output tests before processing untrusted CSS; do not force an override of Next internals in Phase 1. This remains an assessed unresolved risk.
### postcss - high (transitive)

- [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93); affected range `<8.5.10`.
- [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q); affected range `<=8.5.11`.
- [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp); affected range `<=8.5.22`.
- [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849); affected range `<=8.5.17`.

Execution path: Next pins its own PostCSS 8.4.31 for CSS compilation; the root newer PostCSS does not replace it. Crafted sourceMappingURL/CSS input can trigger the reported file-read/XSS paths during processing. Source CSS is checked-in today, but PR/build input is not a security boundary. Remediation: review a Next/PostCSS-compatible patch or Next 16 migration with full build/output tests before processing untrusted CSS; do not force an override of Next internals in Phase 1. This remains an assessed unresolved risk.
### postcss-nested - moderate (transitive)

- Inherited via `postcss-selector-parser`. See that package assessment below.

Execution path: Tailwind/postcss-nested selector parsing at CSS build time. Current parser 6.x remains inside the reported quadratic-complexity range; 7.1.6+ requires parent compatibility review. Remediation: upgrade parent/parser with CSS output and build performance regression tests alongside the planned Tailwind/toolchain migration. No runtime customer-selector endpoint was found, but untrusted build inputs still require isolation.
### postcss-selector-parser - moderate (transitive)

- [PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf); affected range `<7.1.6`.

Execution path: Tailwind/postcss-nested selector parsing at CSS build time. Current parser 6.x remains inside the reported quadratic-complexity range; 7.1.6+ requires parent compatibility review. Remediation: upgrade parent/parser with CSS output and build performance regression tests alongside the planned Tailwind/toolchain migration. No runtime customer-selector endpoint was found, but untrusted build inputs still require isolation.
### tailwindcss - high (direct)

- Inherited via `chokidar`. See that package assessment below.
- Inherited via `fast-glob`. See that package assessment below.
- Inherited via `micromatch`. See that package assessment below.
- Inherited via `postcss-nested`. See that package assessment below.
- Inherited via `postcss-selector-parser`. See that package assessment below.

Execution path: Tailwind content scanning/watch and/or Next ESLint file matching use braces through glob dependencies. This app currently compiles its own checked-in CSS/configuration; no application route imports these utilities to evaluate customer patterns. Malicious repository/configuration content and PR builds remain a real build-time risk, especially for future source ingestion. Do not execute customer repositories in this toolchain/control plane. No patched compatible braces version was offered by the registry audit; it suggests Tailwind 4 / an incompatible ESLint config downgrade. Remediation: isolated build workers without secrets, then explicitly tested Tailwind/glob/lint migration or upstream patched dependency in Phase 2, before untrusted ingestion. No claim of harmlessness.

## Release handling

CI runs `npm audit --audit-level=critical` to reject newly reported criticals while the assessed highs remain visible in its output. This is not a high-severity clean bill of health. Re-run and review the full audit on every dependency change and before deployment; changed advisory lists require renewed assessment. `npm audit` (without a threshold) remains part of manual Phase 1 validation and returns nonzero for these unresolved findings.

No exploit attempts were performed. Advisory inspection, npm dependency-tree inspection, existing source import/configuration review and full local checks support this assessment. Real provider calls and native image exploitability have not been tested. Production release must resolve applicable high exposures, not merely point to this document.
