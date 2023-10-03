# dntx

[dnt](https://deno.land/x/dnt) but as a command.

```man
dntx - dnt but as a command

USAGE:
  deno run -A https://deno.land/x/dntx/mod.ts -e <entrypoint> [OPTIONS]

OPTIONS:
  -h, --help
    Prints help.

  -e, --entry-point <[type:][name=]path>
    Entry point to build. 
    Name is used in package.json exports or bin field.
    Type is one of: export or bin (default: export).
    Can be used multiple times.
    Must be specified at least once.

  -s, --shim <name[:mode]>
    Shim to use. 
    See dnt docs for available shims.
    Mode can be set to dev.
    Can be used multiple times.
    Defaults to deno.

  -L, --lib <lib>
    TS Lib to use. Sets compilerOptions.lib.
    Can be used multiple times.
    Defaults to ES2022 and DOM.

  -n, --name <name>
    Package name.
    Defaults to last path segment of git remote origin without .git.

  -v, --version <version>
    Package version.
    Defaults to latest git tag without leading v.

  -d, --description <description>
    Package description.
    Defaults to first line of README.md that begins with a word character.

  -l, --license <license>
    Package license.
    Defaults to first word of LICENSE that isn't "the".
    If LICENSE doesn't exist, defaults to MIT.

  --repository <repository>
    Package repository URL (the one that usually begins with git+https).
    Defaults to git remote origin, transformed appropriately.

  --no-script-module
    Disable building script module.

  --no-test
    Disable running tests.

  -o, --out-dir <outDir>
    Output directory.
    Defaults to npm.

  -c, --copy-file <file>
    File to copy to output directory.
    Can be used multiple times.
    Defaults to README.md and LICENSE if they exist.
```