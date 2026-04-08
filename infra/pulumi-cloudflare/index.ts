import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const config = new pulumi.Config("zocket");
const cloudflareAccountId = config.get("cloudflareAccountId");
const existingZoneId = config.get("cloudflareZoneId");
const domainName = config.get("domainName") ?? "zocket.io";
const tenantWildcardRecord = config.get("tenantWildcardRecord") ?? "*";
const tenantWildcardProxied = config.getBoolean("tenantWildcardProxied") ?? false;
const awsStackReference =
  config.get("awsStackReference") ?? `${pulumi.getOrganization()}/zocket-aws/${pulumi.getStack()}`;

const awsStack = new pulumi.StackReference(awsStackReference);
const gatewayHostname = awsStack.requireOutput("publicGatewayHostname");

const managedZone =
  existingZoneId || !cloudflareAccountId
    ? undefined
    : new cloudflare.Zone("platform-zone", {
        account: {
          id: cloudflareAccountId,
        },
        name: domainName,
        type: "full",
      });

const zoneId =
  existingZoneId ??
  managedZone?.id ??
  cloudflare.getZoneOutput({
    filter: {
      name: domainName,
      match: "all",
    },
  }).zoneId;

const tenantDns = new cloudflare.DnsRecord("tenant-wildcard", {
  zoneId,
  name: tenantWildcardRecord,
  type: "CNAME",
  content: gatewayHostname,
  proxied: tenantWildcardProxied,
  ttl: 1,
  comment: "Zocket tenant wildcard routed to the AWS gateway origin",
});

export const zoneName = domainName;
export { zoneId };
export const tenantWildcardHostname = pulumi.interpolate`${tenantWildcardRecord}.${domainName}`;
export const tenantWildcardTarget = gatewayHostname;
export const tenantWildcardRecordId = tenantDns.id;
export const zoneNameServers = managedZone?.nameServers;
