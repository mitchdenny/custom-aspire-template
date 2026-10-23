var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureContainerAppEnvironment("aca");

var pgsql = builder.AddPostgres("pgsql");

var blobs = builder.AddAzureStorage("storage")
    .RunAsEmulator()
    .AddBlobs("blobs");

var server = builder.AddDotnetProject("server", "../TemplateProjectPath.Server/TemplateProjectPath.Server.csproj")
    .WithReference(blobs)
    .WaitFor(blobs)
    .WithReference(pgsql)
    .WaitFor(pgsql)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
    .WithReference(server)
    .WaitFor(server);

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
