// Next writes next-env.d.ts with these references, but only during a build or
// dev run, and that file is gitignored. CI typechecks before it builds, so
// without this the static image imports (assets/site/*.webp) have no type.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
