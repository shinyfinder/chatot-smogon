#!/bin/bash

# I expect that in the future, a build step for TS will be unnecessary. New
# runtimes have built-in transpiler support, there is a "types as comments"
# proposal, many tools support stripping types from TS & seamless "upgrade" to
# .ts when .js is requested (ts-node, esbuild, vite).
#
# So, in anticipation, this repository doesn't bother making stripping types
# part of project-specific build; it is expected that projects will reference
# .js paths, and use tools in development that understand to look for the
# corresponding TS file. In production, we place a .js file next to every .ts
# file (non-negotiable).

set -o pipefail

git ls-files "*.ts" "*.tsx" | xargs node_modules/.bin/esbuild --log-level=error --outbase=. --outdir=.