# Custom Aspire template

A private, unpacked .NET template based on the real Aspire C# + React starter:
C# AppHost, ASP.NET Core API, React/Vite frontend, and the starter's ServiceDefaults
implementation in `TemplateApp.Server/Extensions.cs`.

## Create an app

Requires .NET 10 SDK, Node.js 20.19+ or 22.13+, a container runtime for Azurite,
and an Aspire CLI build that supports `--template-repository`.
Your Git/SSH credentials must have access to this private repository.

```bash
aspire new --template-repository git@github.com:mitchdenny/custom-aspire-template.git
```

Choose the project name when prompted. This repository contains one template;
there are no feature or version questions. Project directories, solution/project
files, references, and the npm package name are renamed for the new app. npm names
are lowercased and characters other than letters, digits, and hyphens become hyphens.
Project files, directories, solution filenames, and path references use the
standard .NET `safe_namespace` form: `custom-aspire` becomes `custom_aspire`,
while `Contoso.Inventory` remains unchanged. The CLI-selected output directory
is independent of this transform. `TemplateProjectPath` handles path content,
`fileRename: TemplateApp` handles filenames, and `sourceName: TemplateNamespace`
handles C#-safe namespace replacements.
Instantiate the template before building; raw path tokens in the template source
are replaced during generation.

For a local clone, run from the directory where you want the new app:

```bash
aspire new --template-repository /absolute/path/to/custom-aspire-template
```

The `--template-repository` option requires the custom-template CLI feature;
it is not available in older installed CLIs. Stock .NET template tooling also works:

```bash
dotnet new install /absolute/path/to/custom-aspire-template
dotnet new custom-aspire --name MyApp --output ./MyApp
```

The root README and template/repository metadata are not copied into new apps.
Build caches, local Azure state, secrets, and dependencies are excluded.

## Run and build the generated app

```bash
cd MyApp
aspire start
```

Aspire runs the API, Vite frontend, and Azurite locally. `server` references and
waits for `blobs`; the API registers `AddAzureBlobServiceClient("blobs")` for DI,
health checks, and telemetry. The original weather endpoint is unchanged.
The browser frontend references and waits for the API.

To build without starting services:

```bash
dotnet build MyApp.AppHost/MyApp.AppHost.csproj
dotnet build MyApp.Server/MyApp.Server.csproj
npm --prefix frontend ci
npm --prefix frontend run build
```

## Azure model

`AppHost.cs` declares `AddAzureContainerAppEnvironment("aca")` and
`AddAzureStorage("storage").RunAsEmulator().AddBlobs("blobs")`.
Local run mode uses Azurite rather than an Azure Storage account.
Publish mode models real Azure Storage, with the API hosted in the Container Apps
environment and the built React assets included in its `wwwroot`.
The Blob Storage reference supplies connection configuration and Azure role
assignments for the API's managed identity on deployment.

Scaffolding and building do not deploy or provision Azure resources.
Deployment is a separate, explicit operation requiring Azure credentials and a
selected subscription. This repository does not perform it.

## Aspire versions and provenance

The template declares `AspireVersion`, defaulting to
`17.0.0-preview.1.26522.1`. The custom Aspire CLI injects its identity SDK version
into that parameter automatically (case-insensitive parameter matching), replacing
the version in `aspire.config.json` and all Aspire package pins. Consumers are not
prompted for it. Stock `dotnet new` uses the default unless explicitly overridden
with `--AspireVersion`.

The template also declares `AspireNuGetSource`, defaulting to the public .NET
daily feed at
`https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet9/nuget/v3/index.json`.
The custom CLI supplies its identity channel's actual package source through
this opt-in parameter (matched case-insensitively), including PR package sources.
The derived `aspireNuGetSourceXml` symbol chains the standard `xmlEncode` form
with a quote-escaping `replace` form before inserting the raw URL or local
directory into an XML attribute in `nuget.config`.
The package source and source-mapping keys stay static and identical.
Stock `dotnet new` can override this with `--AspireNuGetSource`.
Other packages use nuget.org. Injected versions must be available on the supplied
source and support the APIs used by this template.

Original scaffold command:

```bash
aspire new aspire-ts-cs-starter --name TemplateApp --output .scaffold --suppress-agent-init --non-interactive
```

Source CLI: `17.0.0-preview.1.26520.10+ffe52b37fcf42c7d98c68b53d037b790d791de0a`.
The CLI selected starter templates `17.0.0-preview.1.26522.1`.

## Template regression check

```bash
node tests/template-generation.mjs
```

Uses an isolated .NET template hive and disposable generated apps to check
`custom-aspire` and `Contoso.Inventory`: config, solution, AppHost and project
reference paths, C# root namespaces, npm names, exclusions, and C# builds.
Also checks injected feed URLs and local directories containing ampersands and
quotes are attribute-escaped without changing NuGet source/mapping keys.
It does not start services or provision Azure resources.
