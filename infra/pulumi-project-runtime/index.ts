import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config("zocket");
const workspaceId = config.require("workspaceId");
const projectId = config.require("projectId");
const deploymentId = config.require("deploymentId");
const desiredStatus = config.get("desiredStatus") ?? "active";
const clusterArn = config.require("clusterArn");
const privateSubnetIds = config.requireObject<string[]>("privateSubnetIds");
const runtimeSecurityGroupId = config.require("runtimeSecurityGroupId");
const runtimeExecutionRoleArn = config.require("runtimeExecutionRoleArn");
const runtimeImage = config.require("runtimeImage");
const natsUrl = config.require("natsUrl");
const controlPlaneUrl = config.require("controlPlaneUrl");
const controlPlaneInternalToken = config.requireSecret("controlPlaneInternalToken");

const appPort = 8080;
const desiredCount = desiredStatus === "idle" ? 0 : 1;

const runtimeLogs = new aws.cloudwatch.LogGroup(`${projectId}-runtime-logs`, {
  retentionInDays: 7,
  name: `/zocket/runtime/${projectId}`,
});

const taskDefinition = new aws.ecs.TaskDefinition(`${projectId}-runtime-task`, {
  family: `zocket-runtime-${projectId}`,
  cpu: "512",
  memory: "1024",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: runtimeExecutionRoleArn,
  runtimePlatform: {
    cpuArchitecture: "ARM64",
    operatingSystemFamily: "LINUX",
  },
  containerDefinitions: pulumi
    .all([runtimeLogs.name, controlPlaneInternalToken])
    .apply(([logGroupName, internalToken]) =>
      JSON.stringify([
        {
          name: "runtime",
          image: runtimeImage,
          essential: true,
          portMappings: [{ containerPort: appPort, protocol: "tcp" }],
          environment: [
            { name: "NATS_URL", value: natsUrl },
            { name: "API_PORT", value: String(appPort) },
            { name: "CONTROL_PLANE_URL", value: controlPlaneUrl },
            { name: "CONTROL_PLANE_INTERNAL_TOKEN", value: internalToken },
            { name: "WORKSPACE_ID", value: workspaceId },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYMENT_ID", value: deploymentId },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroupName,
              "awslogs-region": aws.config.region,
              "awslogs-stream-prefix": "runtime",
            },
          },
        },
      ]),
    ),
});

const runtimeService = new aws.ecs.Service(`${projectId}-runtime-service`, {
  cluster: clusterArn,
  desiredCount,
  launchType: "FARGATE",
  taskDefinition: taskDefinition.arn,
  networkConfiguration: {
    assignPublicIp: false,
    securityGroups: [runtimeSecurityGroupId],
    subnets: privateSubnetIds,
  },
});

export const serviceName = runtimeService.name;
export const serviceArn = runtimeService.id;
export const taskDefinitionArn = taskDefinition.arn;
