import { parse } from "https://deno.land/std@0.203.0/flags/mod.ts";
import {
  build,
  BuildOptions,
  emptyDir,
} from "https://deno.land/x/dnt@0.39.0/mod.ts";

const flags = parse(Deno.args, {
  boolean: [
    "help",
    "no-script-module",
    "no-test",
  ],
  string: [
    "entry-point",
    "shim",
    "lib",
    "name",
    "version",
    "description",
    "license",
    "repository",
    "declaration",
    "out-dir",
    "copy-file",
  ],
  collect: [
    "entry-point",
    "shim",
    "lib",
    "copy-file",
  ],
  alias: {
    "help": "h",
    "entry-point": "e",
    "shim": "s",
    "lib": "L",
    "name": "n",
    "version": "v",
    "description": "d",
    "license": "l",
    "out-dir": "o",
    "copy-file": "c",
  },
});

if (import.meta.main) {
  if (flags["help"]) {
    // take help text from README.md from between triple backticks and print it
    const readme = await Deno.readTextFile(
      new URL("./README.md", import.meta.url),
    );
    const helpText = readme.match(/```man\n([\s\S]*?)\n```\n/)?.[1];
    if (helpText) {
      console.log(helpText);
    } else {
      console.log("README.md not found");
    }
  } else {
    const buildOptions: BuildOptions = {
      entryPoints: getEntryPoints(flags),
      compilerOptions: {
        lib: getLib(flags),
      },
      shims: getShims(flags),
      package: {
        name: await getName(flags),
        version: await getVersion(flags),
        description: await getDescription(flags),
        license: await getLicense(flags),
        repository: await getRepository(flags),
      },
      scriptModule: getScriptModule(flags),
      test: getTest(flags),
      declaration: getDeclaration(flags),
      outDir: getOutDir(flags),
    };

    console.log("[dntx] Cleaning outDir");
    await emptyDir(buildOptions.outDir);
    console.log("[dntx] Building with dnt");
    await build(buildOptions);
    console.log("[dntx] Copying files");
    await copyFiles(buildOptions.outDir, flags);
  }
}

export function getEntryPoints(
  flags: { "entry-point": string[] },
): BuildOptions["entryPoints"] {
  // parse `--entry-point=type:name=path` into `{ name, path, kind }`
  const entryPoints: BuildOptions["entryPoints"] = [];
  for (const entryPointString of flags["entry-point"]) {
    const [pairString, kind] = entryPointString.split(":", 2).reverse();
    const [path, name] = pairString.split("=", 2).reverse();
    if (name) {
      entryPoints.push({ name, path, kind: kind as any });
    } else if (kind) {
      // https://github.com/denoland/dnt/issues/338
      entryPoints.push({ name: undefined as any, path, kind: kind as any });
    } else {
      entryPoints.push(path);
    }
  }
  console.log("[dntx] Using entryPoints:", entryPoints);
  return entryPoints;
}

export function getLib(
  flags: { "lib": string[] },
): Required<BuildOptions>["compilerOptions"]["lib"] {
  const libs = ["ES2022", "DOM", ...flags["lib"] as any];
  console.log("[dntx] Using compilerOptions.libs:", libs);
  return libs;
}

export function getShims(flags: { "shim": string[] }): BuildOptions["shims"] {
  // parse `--shim=shimName[:mode]` into `{ shimName: mode }` (default mode true)
  const shims: Omit<BuildOptions["shims"], "custom" | "customDev"> = {
    deno: true,
  };
  for (const shimPair of flags["shim"]) {
    const [shim, modeString] = shimPair.split(":", 2);
    const mode = modeString == null ? true : modeString;
    shims[shim as keyof typeof shims] = mode as any;
  }
  console.log("[dntx] Using shims:", shims);
  return shims;
}

export async function getName(
  flags: { "name"?: string },
): Promise<BuildOptions["package"]["name"]> {
  if (flags["name"]) {
    console.log("[dntx] Using package.name:", flags["name"]);
    return flags["name"];
  }
  // get name from git remote origin last path segment, without `.git`
  const remote = await runCommand("git", "remote", "get-url", "origin");
  let name = remote.trim().split(/\/|:/).pop()!;
  if (name.endsWith(".git")) name = name.slice(0, -4);
  console.log("[dntx] Detected package.name:", name);
  return name;
}

export async function getVersion(
  flags: { "version"?: string },
): Promise<BuildOptions["package"]["version"]> {
  if (flags["version"]) {
    console.log("[dntx] Using package.version:", flags["version"]);
    return flags["version"];
  }
  // get version from latest git tag, without leading `v`
  let version = await runCommand("git", "describe", "--tags", "--abbrev=0");
  version = version.trim();
  if (version.startsWith("v")) {
    version = version.slice(1);
  }
  console.log("[dntx] Detected package.version:", version);
  return version;
}

export async function getDescription(
  flags: { "description"?: string },
): Promise<BuildOptions["package"]["description"]> {
  if (flags["description"]) {
    console.log("[dntx] Using package.description:", flags["description"]);
    return flags["description"];
  }
  // read README and find first line that begins with a word character
  const readme = await Deno.readTextFile("README.md");
  const description = readme.split("\n").find((line) => /^\w/.test(line))!;
  console.log("[dntx] Detected package.description:", description);
  return description;
}

export async function getLicense(
  flags: { "license"?: string },
): Promise<BuildOptions["package"]["license"]> {
  if (flags["license"]) {
    console.log("[dntx] Using package.license:", flags["license"]);
    return flags["license"];
  }
  // read LICENSE and take first word of the license that isn't "the"
  try {
    const licenseText = await Deno.readTextFile("LICENSE");
    for (const word of licenseText.split(/\s+/)) {
      if (!word) continue;
      if (word.toLowerCase() === "the") continue;
      console.log("[dntx] Detected package.license:", word);
      return word;
    }
  } catch {
    console.log("[dntx] Using default package.license: MIT");
    return "MIT";
  }
}

export async function getRepository(
  flags: { "repository"?: string },
): Promise<BuildOptions["package"]["repository"] | undefined> {
  if (flags["repository"]) {
    console.log("[dntx] Using package.repository.url:", flags["repository"]);
    return { type: "git", url: flags["repository"] };
  }
  // get repository from git remote origin
  const remote = await runCommand("git", "remote", "get-url", "origin");
  let match;
  let repositoryUrl;
  if (
    (match = remote.match(/^(?<proto>.*?):\/\/(?<origin>.*?)\/(?<path>.*)$/))
  ) {
    // remote is a regular URL
    repositoryUrl = `${match.groups!.proto}://${match.groups!.origin}/${
      match.groups!.path
    }`;
  } else if (
    (match = remote.match(/^(?<user>.*?)@(?<origin>.*?):(?<path>.*)$/))
  ) {
    // remote is an SSH URL
    repositoryUrl = `git+https://${match.groups!.origin}/${match.groups!.path}`;
  }
  if (repositoryUrl) {
    console.log("[dntx] Detected package.repository.url:", repositoryUrl);
    return { type: "git", url: repositoryUrl };
  }
}

export function getScriptModule(
  flags: { "no-script-module": boolean },
): BuildOptions["scriptModule"] {
  const scriptModule = !flags["no-script-module"] ? "cjs" : false;
  console.log("[dntx] Using scriptModule:", scriptModule);
  return scriptModule;
}

export function getTest(flags: { "no-test": boolean }): BuildOptions["test"] {
  const test = !flags["no-test"];
  console.log("[dntx] Using test:", test);
  return test;
}

export function getOutDir(
  flags: { "out-dir"?: string },
): BuildOptions["outDir"] {
  if (flags["out-dir"]) {
    console.log("[dntx] Using outDir:", flags["out-dir"]);
    return flags["out-dir"];
  }
  console.log("[dntx] Using default outDir: npm");
  return "npm";
}

export function getDeclaration(
  flags: { "declaration"?: string },
): BuildOptions["declaration"] {
  if (flags["declaration"]) {
    console.log("[dntx] Using declaration:", flags["declaration"]);
    return flags["declaration"] as any;
  }
}

export async function copyFiles(
  outDir: string,
  flags: { "copy-file": string[] },
) {
  const copyFiles: string[] = [];
  // copy README.md if it exists
  if (await Deno.stat("README.md").catch(() => null)) {
    copyFiles.push("README.md");
  }
  // copy LICENSE if it exists
  if (await Deno.stat("LICENSE").catch(() => null)) {
    copyFiles.push("LICENSE");
  }
  copyFiles.push(...flags["copy-file"]);
  for (const copyFile of copyFiles) {
    console.log("[dntx] Copying file:", copyFile);
    await Deno.copyFile(copyFile, `${outDir}/${copyFile}`);
  }
}

async function runCommand(cmd: string, ...args: string[]) {
  const output = await new Deno.Command(cmd, { args }).output();
  if (output.success) {
    return new TextDecoder().decode(output.stdout).trim();
  } else {
    throw new Error(new TextDecoder().decode(output.stderr));
  }
}
