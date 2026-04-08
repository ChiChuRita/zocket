import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";

const config = new pulumi.Config("zocket");
const domainName = config.get("domainName") ?? "zocket.io";
const controlPlaneUrl = config.require("controlPlaneUrl");
const controlPlaneInternalToken = config.requireSecret("controlPlaneInternalToken");
const internalDomain = config.get("internalDomain") ?? "zocket.internal";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectDir, "../..");
const region = aws.config.region ?? "us-west-2";
const appPort = {
  gateway: 3000,
  nats: 4222,
} as const;

const availabilityZones = aws.getAvailabilityZonesOutput({ state: "available" });
const amazonLinuxArm64 = aws.ec2.getAmiOutput({
  mostRecent: true,
  owners: ["137112412989"],
  filters: [
    { name: "name", values: ["al2023-ami-2023.*-arm64"] },
    { name: "architecture", values: ["arm64"] },
  ],
});

const vpc = new aws.ec2.Vpc("zocket-vpc", {
  cidrBlock: "10.42.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: { Name: "zocket-vpc" },
});

const internetGateway = new aws.ec2.InternetGateway("zocket-igw", {
  vpcId: vpc.id,
});

const publicRouteTable = new aws.ec2.RouteTable("zocket-public-rt", {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id }],
});

const publicSubnets = ["10.42.0.0/24", "10.42.1.0/24"].map(
  (cidrBlock, index) =>
    new aws.ec2.Subnet(`zocket-public-${index + 1}`, {
      vpcId: vpc.id,
      cidrBlock,
      availabilityZone: availabilityZones.names[index],
      mapPublicIpOnLaunch: true,
      tags: { Name: `zocket-public-${index + 1}` },
    }),
);

publicSubnets.forEach((subnet, index) => {
  new aws.ec2.RouteTableAssociation(`zocket-public-rta-${index + 1}`, {
    subnetId: subnet.id,
    routeTableId: publicRouteTable.id,
  });
});

const natEip = new aws.ec2.Eip("zocket-nat-eip", {
  domain: "vpc",
});

const natGateway = new aws.ec2.NatGateway("zocket-nat", {
  allocationId: natEip.id,
  subnetId: publicSubnets[0].id,
});

const privateRouteTable = new aws.ec2.RouteTable("zocket-private-rt", {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", natGatewayId: natGateway.id }],
});

const privateSubnets = ["10.42.10.0/24", "10.42.11.0/24"].map(
  (cidrBlock, index) =>
    new aws.ec2.Subnet(`zocket-private-${index + 1}`, {
      vpcId: vpc.id,
      cidrBlock,
      availabilityZone: availabilityZones.names[index],
      mapPublicIpOnLaunch: false,
      tags: { Name: `zocket-private-${index + 1}` },
    }),
);

privateSubnets.forEach((subnet, index) => {
  new aws.ec2.RouteTableAssociation(`zocket-private-rta-${index + 1}`, {
    subnetId: subnet.id,
    routeTableId: privateRouteTable.id,
  });
});

const gatewaySecurityGroup = new aws.ec2.SecurityGroup("gateway-sg", {
  vpcId: vpc.id,
  ingress: [{
    protocol: "tcp",
    fromPort: appPort.gateway,
    toPort: appPort.gateway,
    cidrBlocks: ["0.0.0.0/0"],
  }],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
});

const runtimeSecurityGroup = new aws.ec2.SecurityGroup("runtime-sg", {
  vpcId: vpc.id,
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
});

const natsSecurityGroup = new aws.ec2.SecurityGroup("nats-sg", {
  vpcId: vpc.id,
  ingress: [{
    protocol: "tcp",
    fromPort: appPort.nats,
    toPort: appPort.nats,
    securityGroups: [gatewaySecurityGroup.id, runtimeSecurityGroup.id],
  }],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
});

const gatewayRepository = new aws.ecr.Repository("gateway-repo", {
  forceDelete: true,
  imageTagMutability: "MUTABLE",
  name: "zocket-gateway",
});

const runtimeRepository = new aws.ecr.Repository("runtime-repo", {
  forceDelete: true,
  imageTagMutability: "MUTABLE",
  name: "zocket-runtime",
});

function createImage(
  name: string,
  repository: aws.ecr.Repository,
  dockerfile: string,
) {
  const auth = aws.ecr.getAuthorizationTokenOutput({ registryId: repository.registryId });

  return new docker.Image(name, {
    imageName: pulumi.interpolate`${repository.repositoryUrl}:latest`,
    build: {
      context: repoRoot,
      dockerfile: path.join(repoRoot, dockerfile),
      platform: "linux/arm64",
    },
    registry: {
      server: auth.proxyEndpoint,
      username: auth.userName,
      password: auth.password,
    },
  });
}

function repositoryServer(repository: aws.ecr.Repository) {
  return repository.repositoryUrl.apply((url) => url.split("/")[0]!);
}

const gatewayImage = createImage("gateway-image", gatewayRepository, "packages/gateway/Dockerfile");
const runtimeImage = createImage("runtime-image", runtimeRepository, "packages/runtime/Dockerfile");

const gatewayRole = new aws.iam.Role("gateway-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ec2.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("gateway-role-ecr", {
  role: gatewayRole.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
});

new aws.iam.RolePolicyAttachment("gateway-role-ssm", {
  role: gatewayRole.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
});

const gatewayProfile = new aws.iam.InstanceProfile("gateway-profile", {
  role: gatewayRole.name,
});

const natsRole = new aws.iam.Role("nats-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ec2.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("nats-role-ssm", {
  role: natsRole.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
});

const natsProfile = new aws.iam.InstanceProfile("nats-profile", {
  role: natsRole.name,
});

const gatewayUserData = pulumi.interpolate`#!/bin/bash
set -euxo pipefail
dnf update -y
dnf install -y docker
systemctl enable --now docker
mkdir -p /etc/zocket
cat > /etc/zocket/gateway.env <<'EOF'
NATS_URL=nats://nats.${internalDomain}:${appPort.nats}
PORT=${appPort.gateway}
CONTROL_PLANE_URL=${controlPlaneUrl}
CONTROL_PLANE_INTERNAL_TOKEN=${controlPlaneInternalToken}
EOF
cat > /etc/systemd/system/zocket-gateway.service <<'EOF'
[Unit]
Description=Zocket Gateway
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f zocket-gateway
ExecStartPre=/bin/sh -c '/usr/bin/aws ecr get-login-password --region ${region} | /usr/bin/docker login --username AWS --password-stdin ${repositoryServer(gatewayRepository)}'
ExecStartPre=/usr/bin/docker pull ${gatewayImage.imageName}
ExecStart=/usr/bin/docker run --name zocket-gateway --env-file /etc/zocket/gateway.env -p ${appPort.gateway}:${appPort.gateway} ${gatewayImage.imageName}
ExecStop=/usr/bin/docker stop zocket-gateway

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now zocket-gateway
`;

const natsUserData = pulumi.interpolate`#!/bin/bash
set -euxo pipefail
dnf update -y
dnf install -y docker xfsprogs
systemctl enable --now docker
DEVICE=/dev/xvdb
while [ ! -b "$DEVICE" ]; do sleep 1; done
if ! blkid "$DEVICE"; then
  mkfs.xfs "$DEVICE"
fi
mkdir -p /data
if ! grep -q "$DEVICE /data" /etc/fstab; then
  echo "$DEVICE /data xfs defaults,nofail 0 2" >> /etc/fstab
fi
mount -a
cat > /etc/systemd/system/zocket-nats.service <<'EOF'
[Unit]
Description=Zocket NATS
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f zocket-nats
ExecStartPre=/usr/bin/docker pull nats:2.11-alpine
ExecStart=/usr/bin/docker run --name zocket-nats -p ${appPort.nats}:${appPort.nats} -v /data:/data nats:2.11-alpine -js -sd /data
ExecStop=/usr/bin/docker stop zocket-nats

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now zocket-nats
`;

const gatewayInstance = new aws.ec2.Instance("gateway-instance", {
  ami: amazonLinuxArm64.id,
  instanceType: "t4g.medium",
  subnetId: privateSubnets[0].id,
  vpcSecurityGroupIds: [gatewaySecurityGroup.id],
  associatePublicIpAddress: false,
  iamInstanceProfile: gatewayProfile.name,
  userData: gatewayUserData,
  tags: { Name: "zocket-gateway" },
}, { dependsOn: [gatewayImage] });

const natsInstance = new aws.ec2.Instance("nats-instance", {
  ami: amazonLinuxArm64.id,
  instanceType: "t4g.small",
  subnetId: privateSubnets[1].id,
  vpcSecurityGroupIds: [natsSecurityGroup.id],
  associatePublicIpAddress: false,
  iamInstanceProfile: natsProfile.name,
  userData: natsUserData,
  ebsBlockDevices: [{
    deviceName: "/dev/xvdb",
    volumeType: "gp3",
    volumeSize: 20,
    deleteOnTermination: false,
  }],
  tags: { Name: "zocket-nats" },
});

const internalZone = new aws.route53.Zone("internal-zone", {
  name: internalDomain,
  vpcs: [{ vpcId: vpc.id }],
});

new aws.route53.Record("nats-internal-record", {
  zoneId: internalZone.zoneId,
  name: `nats.${internalDomain}`,
  type: "A",
  ttl: 60,
  records: [natsInstance.privateIp],
});

const gatewayLoadBalancer = new aws.lb.LoadBalancer("gateway-nlb", {
  loadBalancerType: "network",
  subnets: publicSubnets.map((subnet) => subnet.id),
});

const gatewayTargetGroup = new aws.lb.TargetGroup("gateway-tg", {
  port: appPort.gateway,
  protocol: "TCP",
  targetType: "instance",
  vpcId: vpc.id,
  healthCheck: {
    protocol: "HTTP",
    path: "/health",
    port: `${appPort.gateway}`,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
    matcher: "200",
  },
});

new aws.lb.TargetGroupAttachment("gateway-attachment", {
  targetGroupArn: gatewayTargetGroup.arn,
  targetId: gatewayInstance.id,
  port: appPort.gateway,
});

new aws.lb.Listener("gateway-tls-listener", {
  loadBalancerArn: gatewayLoadBalancer.arn,
  port: 80,
  protocol: "TCP",
  defaultActions: [{ type: "forward", targetGroupArn: gatewayTargetGroup.arn }],
});

const cluster = new aws.ecs.Cluster("runtime-cluster", {
  name: "zocket-hosted",
});

const executionRole = new aws.iam.Role("runtime-execution-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("runtime-execution-role-policy", {
  role: executionRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

export const gatewayLoadBalancerDns = gatewayLoadBalancer.dnsName;
export const gatewayRepositoryUrl = gatewayRepository.repositoryUrl;
export const runtimeRepositoryUrl = runtimeRepository.repositoryUrl;
export const runtimeImageName = runtimeImage.imageName;
export const vpcId = vpc.id;
export const publicSubnetIds = publicSubnets.map((subnet) => subnet.id);
export const privateSubnetIds = privateSubnets.map((subnet) => subnet.id);
export const runtimeClusterArn = cluster.arn;
export const runtimeClusterName = cluster.name;
export const runtimeSecurityGroupId = runtimeSecurityGroup.id;
export const runtimeExecutionRoleArn = executionRole.arn;
export const natsDnsName = pulumi.interpolate`nats.${internalDomain}`;
export const natsUrl = pulumi.interpolate`nats://nats.${internalDomain}:${appPort.nats}`;
export const domainSuffix = domainName;
export const publicGatewayHostname = gatewayLoadBalancer.dnsName;
export const awsRegion = region;
