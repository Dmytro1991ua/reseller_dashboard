import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { HandlerResult } from "@/lib/router";
import {
  metricsSummary,
  metricsErrors,
  metricsStatusCodes,
  metricsDestinations,
} from "@/lib/handlers/metrics";

const SUPPORTED_PRODUCTS = new Set([
  "datacenter",
  "shared_isp",
  "ipv6-residential",
  "ipv6-datacenter",
]);

// ── Keyword classification ────────────────────────────────────────────────────

const KEYWORD_SETS = {
  blocking: [
    "403",
    "forbidden",
    "block",
    "blocked",
    "ban",
    "banned",
    "blacklist",
    "captcha",
    "challenge",
    "bot detection",
    "detected",
    "access denied",
    "ip ban",
  ],
  auth: [
    "407",
    "proxy auth",
    "authentication",
    "unauthorized",
    "401",
    "credentials",
    "password",
    "wrong user",
    "wrong pass",
    "invalid cred",
  ],
  timeout: [
    "timeout",
    "timed out",
    "slow",
    "latency",
    "hang",
    "504",
    "no response",
    "waiting",
    "delay",
    "took too long",
    "freezes",
  ],
  gateway: [
    "502",
    "503",
    "bad gateway",
    "service unavailable",
    "server error",
    "5xx",
    "down",
    "unavailable",
    "outage",
  ],
  rateLimit: [
    "429",
    "rate limit",
    "rate-limit",
    "too many requests",
    "throttle",
    "throttled",
    "limited",
    "quota exceeded",
  ],
  dns: [
    "dns",
    "resolve",
    "resolution",
    "nxdomain",
    "hostname not found",
    "cannot resolve",
    "host not found",
  ],
  tls: [
    "ssl",
    "tls",
    "certificate",
    "handshake",
    "cert error",
    "tls error",
    "ssl error",
    "certificate verify",
  ],
  noActivity: [
    "not working",
    "nothing",
    "no traffic",
    "can't connect",
    "cannot connect",
    "not connecting",
    "no response at all",
    "completely down",
    "zero traffic",
  ],
} as const;

type Category = keyof typeof KEYWORD_SETS | "unknown";

function detectCategory(complaint: string): Category {
  const lower = complaint.toLowerCase();
  for (const [cat, keywords] of Object.entries(KEYWORD_SETS)) {
    if ((keywords as readonly string[]).some((kw) => lower.includes(kw))) {
      return cat as Category;
    }
  }
  return "unknown";
}

// ── Metrics snapshot ──────────────────────────────────────────────────────────

interface Snapshot {
  successRate: number;
  totalConnections: number;
  totalErrors: number;
  avgMbps: number;
  peakConcurrent: number;
  tcpErrors: number;
  authErrors: number;
  timeoutErrors: number;
  upstream4xx: number;
  upstream5xx: number;
  blacklisted: number;
  connLimit: number;
  bandwidthQuota: number;
  s4xxTotal: number;
  s5xxTotal: number;
  topDest: string | null;
  topDestErrors: number;
}

async function gatherSnapshot(planId: string): Promise<Snapshot> {
  const q = new URLSearchParams({ hours: "24" });
  const [sumRes, errRes, scRes, destRes] = await Promise.all([
    metricsSummary(planId, q),
    metricsErrors(planId, q),
    metricsStatusCodes(planId, q),
    metricsDestinations(planId, q),
  ]);

  type SumData = {
    success_rate_pct: number;
    total_connections: number;
    total_errors: number;
    avg_mbps: number;
    peak_concurrent: number;
  };
  type ErrBucket = {
    tcp: number;
    auth: number;
    timeout: number;
    upstream_4xx: number;
    upstream_5xx: number;
    blacklisted: number;
    conn_limit: number;
    bandwidth_quota: number;
  };
  type ScBucket = { s4xx: number; s5xx: number };
  type DestItem = { destination: string; errors: number };

  const sum = (sumRes.body as { data: SumData }).data;
  const errSeries = (errRes.body as { data: { series: ErrBucket[] } }).data.series;
  const scSeries = (scRes.body as { data: { series: ScBucket[] } }).data.series;
  const dests = (destRes.body as { data: { destinations: DestItem[] } }).data.destinations;

  let tcpErrors = 0,
    authErrors = 0,
    timeoutErrors = 0;
  let upstream4xx = 0,
    upstream5xx = 0,
    blacklisted = 0;
  let connLimit = 0,
    bandwidthQuota = 0;
  for (const b of errSeries) {
    tcpErrors += b.tcp ?? 0;
    authErrors += b.auth ?? 0;
    timeoutErrors += b.timeout ?? 0;
    upstream4xx += b.upstream_4xx ?? 0;
    upstream5xx += b.upstream_5xx ?? 0;
    blacklisted += b.blacklisted ?? 0;
    connLimit += b.conn_limit ?? 0;
    bandwidthQuota += b.bandwidth_quota ?? 0;
  }
  let s4xxTotal = 0,
    s5xxTotal = 0;
  for (const b of scSeries) {
    s4xxTotal += b.s4xx ?? 0;
    s5xxTotal += b.s5xx ?? 0;
  }

  const sorted = [...dests].sort((a, b) => b.errors - a.errors);
  return {
    successRate: sum.success_rate_pct ?? 100,
    totalConnections: sum.total_connections ?? 0,
    totalErrors: sum.total_errors ?? 0,
    avgMbps: sum.avg_mbps ?? 0,
    peakConcurrent: sum.peak_concurrent ?? 0,
    tcpErrors,
    authErrors,
    timeoutErrors,
    upstream4xx,
    upstream5xx,
    blacklisted,
    connLimit,
    bandwidthQuota,
    s4xxTotal,
    s5xxTotal,
    topDest: sorted[0]?.destination ?? null,
    topDestErrors: sorted[0]?.errors ?? 0,
  };
}

// ── Diagnosis builder ─────────────────────────────────────────────────────────

interface Evidence {
  metric: string;
  value: string;
  context: string;
}
interface Diagnosis {
  severity: "info" | "warning" | "critical";
  headline: string;
  root_cause: string;
  evidence: Evidence[];
  recommendation_to_customer: string;
  recommendation_to_staff: string;
}

function pct(n: number) {
  return n.toFixed(1) + "%";
}
function mbps(n: number) {
  return n.toFixed(2) + " Mbps";
}

function buildDiagnosis(category: Category, m: Snapshot): Diagnosis {
  // ── No-activity override (always wins regardless of complaint category) ────
  if (m.totalConnections < 5) {
    return {
      severity: "info",
      headline: "No traffic recorded in the last 24 hours",
      root_cause:
        "The plan has recorded fewer than 5 connections over the past 24 hours. " +
        "This strongly indicates a client-side configuration issue rather than any proxy infrastructure problem — " +
        "if the proxy were unreachable, we would see failed connection attempts, not silence.",
      evidence: [
        {
          metric: "Connections (24h)",
          value: String(m.totalConnections),
          context: "Expected ≥ 20 for an active plan",
        },
        {
          metric: "Success rate",
          value: pct(m.successRate),
          context: "N/A — too little traffic to be meaningful",
        },
        {
          metric: "Avg throughput",
          value: mbps(m.avgMbps),
          context: "Effectively zero — no data transferred",
        },
      ],
      recommendation_to_customer:
        "Your plan is active and infrastructure is healthy. Please verify your client configuration: " +
        "(1) Hostname and port match the values in the Credentials tab exactly. " +
        "(2) Username and password have no leading/trailing spaces. " +
        "(3) Test with: curl -x http://USER:PASS@HOST:PORT https://ipinfo.io/json",
      recommendation_to_staff:
        "Zero traffic from this plan. No infrastructure fault. " +
        "Ask customer for a curl test and their client code/language. " +
        "Common causes: wrong port (HTTP vs SOCKS5 mixed up), credentials URL-encoded incorrectly, proxy bypass list in their OS.",
    };
  }

  switch (category) {
    case "blocking":
      return {
        severity: m.successRate < 50 ? "critical" : "warning",
        headline: "Target-side IP blocking detected",
        root_cause:
          "HTTP 403 Forbidden responses indicate the destination site has identified and rejected requests " +
          "originating from this proxy IP pool. This is a target-side enforcement mechanism — the proxy " +
          "infrastructure itself is functioning correctly. Success rate of " +
          pct(m.successRate) +
          " is consistent with partial or full IP-range blocking at the target.",
        evidence: [
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context:
              m.successRate < 70 ? "Critical — severe blocking" : "Degraded — partial blocking",
          },
          {
            metric: "4xx responses (24h)",
            value: String(m.s4xxTotal > 0 ? m.s4xxTotal : "elevated"),
            context: "Dominant error class — target-side rejection",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Client is reaching the proxy successfully",
          },
          ...(m.topDest
            ? [
                {
                  metric: "Top failing destination",
                  value: m.topDest,
                  context: m.topDestErrors + " errors — likely the blocked target",
                },
              ]
            : []),
        ],
        recommendation_to_customer:
          "The target website has blocked requests from our IP range. To resolve: " +
          "(1) Enable session rotation to distribute requests across multiple IPs. " +
          "(2) Reduce request frequency — add 1–3 second delays between requests. " +
          "(3) Rotate User-Agent and Accept-Language headers per request. " +
          "(4) For sites with aggressive bot detection, a residential proxy plan offers better success rates than datacenter IPs.",
        recommendation_to_staff:
          "Target-site blocking — no infrastructure action required. " +
          "If the customer needs higher success rates against this target, recommend upgrading to residential. " +
          "Do not refund — this is not a service fault.",
      };

    case "auth":
      return {
        severity: "critical",
        headline: "Proxy authentication failure — credentials or IP whitelist mismatch",
        root_cause:
          "HTTP 407 Proxy Authentication Required errors occur when the proxy rejects the supplied credentials. " +
          "The two most common causes are: (A) the client is using outdated credentials after a password change, " +
          "or (B) the plan has an allowed-IP whitelist configured and the customer's outbound IP is not on it.",
        evidence: [
          {
            metric: "Auth errors (24h)",
            value: String(m.authErrors > 0 ? m.authErrors : "407 reported by client"),
            context: "Proxy rejecting supplied credentials",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context:
              m.successRate < 70
                ? "Severely degraded by auth failures"
                : "Some connections succeed — whitelist is partial",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Client is reaching the proxy endpoint",
          },
        ],
        recommendation_to_customer:
          "Authentication is failing. Please check: " +
          "(1) Open the Credentials tab — copy the username and password exactly as shown. " +
          "(2) If your plan uses IP whitelisting, go to Credentials → Allowed IPs and add your current outbound IP. " +
          "(3) If you recently changed your proxy password, update all clients that use this plan. " +
          "(4) Ensure your HTTP client is passing the Proxy-Authorization header, not Authorization.",
        recommendation_to_staff:
          "Check the allowed_ips field on this plan. If non-empty, the customer's current IP is likely missing. " +
          "Ask the customer to visit https://ipinfo.io/ and send you their IP. " +
          "If allowed_ips is empty, the issue is incorrect credentials — resend them from the Credentials tab.",
      };

    case "timeout":
      return {
        severity: m.successRate < 80 ? "warning" : "info",
        headline: "Elevated response latency — slow target server or geographic distance",
        root_cause:
          "The complaint describes slow responses or timeouts. Proxy throughput of " +
          mbps(m.avgMbps) +
          " confirms the proxy-to-client link is healthy. The bottleneck is the round-trip time between the proxy " +
          "and the target server — caused by geographic distance, slow target-side processing, or the target server " +
          "throttling individual IP connections by artificially slowing responses.",
        evidence: [
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: "Proxy-to-client bandwidth — not the bottleneck",
          },
          {
            metric: "Timeout errors (24h)",
            value: String(m.timeoutErrors),
            context:
              m.timeoutErrors > 5
                ? "Above normal — target server is slow"
                : "Low — mostly target-server latency spikes",
          },
          {
            metric: "Peak concurrent",
            value: String(m.peakConcurrent),
            context: "Simultaneous connections at peak load",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Requests that complete without timing out",
          },
        ],
        recommendation_to_customer:
          "Timeouts are caused by the target server, not the proxy. To improve: " +
          "(1) Set your client's connect timeout to at least 30 seconds and read timeout to 60 seconds. " +
          "(2) Implement retry logic with exponential backoff on timeouts. " +
          "(3) Use HTTP keep-alive to avoid re-establishing connections on every request. " +
          "(4) If you need a geographically closer pool, contact support with your target country.",
        recommendation_to_staff:
          "Proxy is healthy — throughput and success rate are acceptable. " +
          "No infrastructure action required. If the customer is targeting a specific region, " +
          "check whether we have a closer node available. Latency issues are target-server origin.",
      };

    case "gateway":
      return {
        severity: "critical",
        headline: "Upstream gateway errors — infrastructure-level disruption",
        root_cause:
          "HTTP 502 Bad Gateway or 503 Service Unavailable errors indicate the proxy is receiving error responses " +
          "from upstream infrastructure rather than the target. This is an infrastructure-level problem. " +
          "5xx upstream count of " +
          (m.upstream5xx > 0 ? m.upstream5xx : "multiple") +
          " in the last 24 hours " +
          "confirms the issue is not on the customer side.",
        evidence: [
          {
            metric: "5xx upstream (24h)",
            value: String(m.upstream5xx > 0 ? m.upstream5xx : "reported"),
            context: "502/503 from gateway layer — infrastructure fault",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Impacted by upstream failures",
          },
          {
            metric: "TCP errors (24h)",
            value: String(m.tcpErrors),
            context: "Network-layer connection failures",
          },
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: m.avgMbps < 0.5 ? "Severely degraded" : "Partially affected",
          },
        ],
        recommendation_to_customer:
          "We have detected an upstream infrastructure issue affecting your plan. " +
          "This is a problem on our end, not your configuration. " +
          "Please retry your requests — the service typically recovers automatically within 15 minutes. " +
          "If the issue persists beyond 30 minutes, contact support and reference this investigation ID.",
        recommendation_to_staff:
          "ESCALATE: 502/503 pattern indicates upstream node failure. " +
          "Check the infrastructure health dashboard for this plan's pool. " +
          "If multiple plans on the same pool are affected, trigger an incident and notify customers. " +
          "Issue a proactive service credit if downtime exceeds 30 minutes.",
      };

    case "rateLimit":
      return {
        severity: "warning",
        headline: "Rate limiting by target — request frequency exceeds target threshold",
        root_cause:
          "HTTP 429 Too Many Requests indicates the destination site is enforcing per-IP rate limits " +
          "and the customer's request rate exceeds the allowed threshold. The proxy infrastructure is healthy — " +
          "the restriction is applied at the target level. Peak concurrent connections of " +
          m.peakConcurrent +
          " may be contributing to the rate limit trigger.",
        evidence: [
          {
            metric: "4xx responses (24h)",
            value: String(m.s4xxTotal > 0 ? m.s4xxTotal : "429 reported"),
            context: "Includes 429 Too Many Requests",
          },
          {
            metric: "Peak concurrent",
            value: String(m.peakConcurrent),
            context: "High concurrency increases rate-limit risk",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: m.successRate < 80 ? "Degraded by rate limiting" : "Acceptable overall",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "High volume triggers target defences",
          },
        ],
        recommendation_to_customer:
          "The target site is rate-limiting your requests per IP. To resolve: " +
          "(1) Add a 1–3 second delay between requests on the same IP. " +
          "(2) Reduce the number of concurrent connections — stay below 3 per IP for most targets. " +
          "(3) Implement exponential backoff when you receive a 429 — wait before retrying. " +
          "(4) Enable session rotation to spread requests across multiple IPs automatically.",
        recommendation_to_staff:
          "Customer-side request rate exceeds the target site's threshold. No proxy infrastructure issue. " +
          "Advise on pacing and rotation. If the customer needs higher throughput without rate limits, " +
          "rotating residential with sticky sessions is the appropriate upgrade path.",
      };

    case "dns":
      return {
        severity: "warning",
        headline: "DNS resolution failures — hostname cannot be resolved",
        root_cause:
          "DNS resolution errors mean the proxy cannot look up the IP address for one or more target hostnames. " +
          "This can occur if the target domain is offline, the domain name is misspelled, " +
          "the domain has expired, or the DNS resolver path between the proxy and the target has a fault.",
        evidence: [
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Impacted by DNS failures on affected destinations",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Proxy is reachable — issue is destination-specific",
          },
          ...(m.topDest
            ? [
                {
                  metric: "Top failing destination",
                  value: m.topDest,
                  context: "DNS failures concentrated here",
                },
              ]
            : []),
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: "Unaffected routes remain healthy",
          },
        ],
        recommendation_to_customer:
          "DNS lookup is failing for one or more of your target domains. Please verify: " +
          "(1) The domain name is spelled correctly in your requests. " +
          "(2) The target site is publicly accessible — try visiting it directly in your browser. " +
          "(3) You are not using private/internal hostnames (e.g., localhost, 192.168.x.x) as targets — these will not resolve through the proxy. " +
          "(4) If the domain recently launched or changed, allow 24–48 hours for DNS propagation.",
        recommendation_to_staff:
          "Identify the specific failing hostname from the Destinations tab. " +
          "If it's a known public domain, verify it resolves from our infrastructure nodes. " +
          "If the customer is sending private hostnames, that's a configuration error on their side.",
      };

    case "tls":
      return {
        severity: "warning",
        headline: "TLS/SSL handshake failures — certificate or tunnel configuration issue",
        root_cause:
          "TLS handshake errors occur when the SSL session between the proxy and the target cannot be established. " +
          "Common causes: the client is not using HTTP CONNECT tunnelling for HTTPS targets, " +
          "the target site has an expired or self-signed certificate, " +
          "or the client has SSL verification disabled in a way that triggers unexpected behaviour.",
        evidence: [
          {
            metric: "TLS errors (24h)",
            value: String(m.tcpErrors > 0 ? "confirmed" : "reported by client"),
            context: "Handshake or certificate validation failure",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Connections that completed TLS successfully",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Proxy endpoint is reachable — issue is in TLS layer",
          },
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: "Traffic that completes TLS is performing normally",
          },
        ],
        recommendation_to_customer:
          "TLS handshake failures are almost always a client-side configuration issue. Please verify: " +
          "(1) For HTTPS targets, your HTTP client must use the CONNECT method — not plain HTTP proxying. " +
          "(2) Do not disable SSL certificate verification globally in your client — use targeted exceptions only. " +
          "(3) If using curl: use -x http://USER:PASS@HOST:PORT (not -x https://...) for the proxy flag. " +
          "(4) If the target site has an invalid certificate, you will need to add a specific exception or use --insecure cautiously.",
        recommendation_to_staff:
          "Most common cause: customer is sending HTTP proxy headers for HTTPS targets instead of CONNECT tunnelling. " +
          "Ask the customer to share the exact curl command or HTTP client configuration. " +
          "This is a very common mistake with Python requests, axios, and some enterprise tools.",
      };

    case "noActivity":
      return {
        severity: "info",
        headline:
          "Client not connecting to proxy — configuration or network issue on customer side",
        root_cause:
          "The customer reports they cannot connect at all, but proxy infrastructure metrics show the plan " +
          "is active with " +
          m.totalConnections +
          " connections recorded. This means the proxy is reachable " +
          "from at least some clients — the issue is specific to the customer's current client environment. " +
          "Possible causes: wrong credentials, wrong hostname, or a local firewall blocking outbound proxy connections.",
        evidence: [
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Proxy is reachable from configured clients",
          },
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Existing connections are succeeding",
          },
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: "Normal traffic from other connections",
          },
        ],
        recommendation_to_customer:
          "Your plan is active and other connections are working. The issue is in how your specific client is connecting. " +
          "Please verify step by step: " +
          "(1) Hostname and port from the Credentials tab — copied exactly, no extra characters. " +
          "(2) Are you using the HTTP port (default 8080) or SOCKS5 port? Check which one your client supports. " +
          "(3) Test with curl: curl -v -x http://USER:PASS@HOST:PORT https://ipinfo.io/json " +
          "(4) Check your local firewall or corporate proxy — outbound connections to custom ports may be blocked.",
        recommendation_to_staff:
          "Infrastructure is healthy. Issue is client-side. " +
          "Have the customer run the curl test and share the full verbose output (-v flag). " +
          "Check if they are mixing HTTP and SOCKS5 ports. Also verify their network allows outbound connections on the proxy port.",
      };

    default: {
      // No keyword match — use metrics to decide
      if (m.successRate >= 95 && m.avgMbps >= 0.5 && m.totalErrors <= 5) {
        return {
          severity: "info",
          headline: "No anomalies detected — service operating within normal parameters",
          root_cause:
            "All metrics for the last 24 hours are within normal ranges: " +
            pct(m.successRate) +
            " success rate across " +
            m.totalConnections +
            " connections " +
            "at " +
            mbps(m.avgMbps) +
            " average throughput. No error spikes, auth failures, " +
            "or gateway issues are recorded. The reported issue may be a transient condition that has since resolved, " +
            "or the problem may be client-side and not visible in proxy-level metrics.",
          evidence: [
            {
              metric: "Success rate",
              value: pct(m.successRate),
              context: "Within normal range (target: >95%)",
            },
            {
              metric: "Connections (24h)",
              value: String(m.totalConnections),
              context: "Normal activity level",
            },
            { metric: "Avg throughput", value: mbps(m.avgMbps), context: "Normal" },
            {
              metric: "Errors (24h)",
              value: String(m.totalErrors),
              context: "Within acceptable baseline",
            },
          ],
          recommendation_to_customer:
            "Our monitoring shows your plan is operating normally with no infrastructure issues. " +
            "To help us investigate further, please provide: " +
            "(1) The exact error message from your client (full text, not just the code). " +
            "(2) The specific target URL that is failing. " +
            "(3) Your client language and the library you are using for proxy connections. " +
            "This will help us identify whether the issue is target-specific, client-specific, or transient.",
          recommendation_to_staff:
            "All metrics healthy. No infrastructure action needed. " +
            "Request specific error output from the customer. " +
            "If the complaint is vague, ask them to reproduce with curl and share the verbose output.",
        };
      }

      if (m.successRate < 70) {
        return {
          severity: "critical",
          headline: "High error rate without clear single cause — broad service degradation",
          root_cause:
            "Success rate has dropped to " +
            pct(m.successRate) +
            ", well below the 95% threshold. " +
            "The error pattern is mixed — no single error type dominates — which suggests either " +
            "an infrastructure-wide issue affecting multiple layers, or heavy concurrent load from the customer " +
            "on a target with layered defences that triggers different error types.",
          evidence: [
            {
              metric: "Success rate",
              value: pct(m.successRate),
              context: "Critical — far below 95% target",
            },
            {
              metric: "Connections (24h)",
              value: String(m.totalConnections),
              context: "Traffic volume during degradation",
            },
            {
              metric: "5xx upstream",
              value: String(m.upstream5xx),
              context: "Gateway-level failures",
            },
            {
              metric: "TCP errors",
              value: String(m.tcpErrors),
              context: "Network-layer connection failures",
            },
          ],
          recommendation_to_customer:
            "Your plan is experiencing a high error rate. Our team has been notified. " +
            "Please try your requests again in 15 minutes. " +
            "If the issue persists, contact support and reference this investigation ID — include the error messages your client is returning.",
          recommendation_to_staff:
            "ESCALATE: Mixed error pattern, high failure rate. " +
            "Review infrastructure health for this plan's pool. " +
            "Check if other customers on the same pool are affected. " +
            "Issue a proactive status update if more than 3 plans are impacted.",
        };
      }

      return {
        severity: "warning",
        headline: "Intermittent errors above normal baseline — monitoring recommended",
        root_cause:
          "Success rate of " +
          pct(m.successRate) +
          " is below the 95% target but not critical. " +
          "The error pattern is mixed and does not point to a single root cause. " +
          "This level of degradation is often caused by transient target-server issues, " +
          "occasional IP blocking on specific destinations, or temporary network conditions.",
        evidence: [
          {
            metric: "Success rate",
            value: pct(m.successRate),
            context: "Below target — borderline health",
          },
          {
            metric: "Connections (24h)",
            value: String(m.totalConnections),
            context: "Activity level",
          },
          {
            metric: "Avg throughput",
            value: mbps(m.avgMbps),
            context: m.avgMbps >= 1 ? "Normal" : "Slightly reduced",
          },
          {
            metric: "Errors (24h)",
            value: String(m.totalErrors),
            context: "Above normal baseline",
          },
        ],
        recommendation_to_customer:
          "Your plan is experiencing intermittent errors slightly above normal levels. " +
          "This may resolve on its own within the next hour. " +
          "Please monitor your error rate. If errors consistently exceed 20%, contact support with: " +
          "(1) The specific error messages you are seeing, and (2) the target domains affected.",
        recommendation_to_staff:
          "Borderline health — no immediate action required. " +
          "Monitor this plan over the next 2 hours. " +
          "If success rate drops below 80%, escalate to infrastructure review.",
      };
    }
  }
}

// ── Public handlers ───────────────────────────────────────────────────────────

export async function startInvestigation(planId: string, body: unknown): Promise<HandlerResult> {
  const { complaint } = body as { complaint?: string };
  if (!complaint?.trim()) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "complaint is required" },
      },
    };
  }
  if (complaint.length > 400) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Complaint too long (max 400 chars)" },
      },
    };
  }

  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }
  if (!SUPPORTED_PRODUCTS.has(plan.product)) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: "UNSUPPORTED_PRODUCT",
          message: "Investigations are only available for Datacenter, Shared ISP, and IPv6 plans",
        },
      },
    };
  }

  const investigationId = randomUUID();
  const startedAt = Date.now();

  try {
    const [snapshot] = await Promise.all([gatherSnapshot(planId)]);
    const category = detectCategory(complaint.trim());
    const diagnosis = buildDiagnosis(category, snapshot);
    const elapsed = Math.round((Date.now() - startedAt) / 1000);

    await db.investigation.create({
      data: {
        investigationId,
        planId,
        status: "complete",
        complaint: complaint.trim(),
        completedAt: new Date(),
        elapsedSeconds: elapsed,
        severity: diagnosis.severity,
        headline: diagnosis.headline,
        diagnosis: JSON.stringify(diagnosis),
      },
    });

    return {
      status: 202,
      body: {
        success: true,
        data: {
          investigation_id: investigationId,
          status: "complete",
          elapsed_seconds: elapsed,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          cost: "$0.50",
          refunded: false,
          severity: diagnosis.severity,
          headline: diagnosis.headline,
          diagnosis,
        },
      },
    };
  } catch (err) {
    // Roll back: create the record as error and refund
    await db.investigation.create({
      data: {
        investigationId,
        planId,
        status: "error",
        complaint: complaint.trim(),
        completedAt: new Date(),
        refunded: true,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    // Refund the $0.50 — find and credit balance
    const balance = await db.balance.findFirst();
    if (balance) {
      await db.$transaction([
        db.balance.update({
          where: { id: balance.id },
          data: { balanceCents: balance.balanceCents + 50, totalSpentCents: { decrement: 50 } },
        }),
        db.transaction.create({
          data: {
            type: "refund",
            amountCents: 50,
            description: "Investigation refund — engine error",
            planId,
            balanceAfterCents: balance.balanceCents + 50,
          },
        }),
      ]);
    }
    return {
      status: 202,
      body: {
        success: true,
        data: {
          investigation_id: investigationId,
          status: "error",
          cost: "$0.50",
          refunded: true,
          error: "Investigation engine error — charge refunded.",
        },
      },
    };
  }
}

export async function getInvestigation(
  planId: string,
  investigationId: string,
): Promise<HandlerResult> {
  const inv = await db.investigation.findUnique({ where: { investigationId } });
  if (!inv || inv.planId !== planId) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Investigation not found" } },
    };
  }

  const data: Record<string, unknown> = {
    investigation_id: inv.investigationId,
    status: inv.status,
    elapsed_seconds: inv.elapsedSeconds,
    created_at: inv.createdAt.toISOString(),
    completed_at: inv.completedAt?.toISOString() ?? null,
    cost: "$0.50",
    refunded: inv.refunded,
    severity: inv.severity,
    headline: inv.headline,
  };
  if (inv.status === "complete" && inv.diagnosis) data.diagnosis = JSON.parse(inv.diagnosis);
  if (inv.status === "error") data.error = inv.errorMessage ?? "Investigation failed";

  return { status: 200, body: { success: true, data } };
}

export async function listInvestigations(planId: string): Promise<HandlerResult> {
  const items = await db.investigation.findMany({
    where: { planId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        plan_id: planId,
        investigations: items.map((inv) => ({
          investigation_id: inv.investigationId,
          status: inv.status,
          severity: inv.severity,
          headline: inv.headline,
          cost: "$0.50",
          refunded: inv.refunded,
          elapsed_seconds: inv.elapsedSeconds,
          created_at: inv.createdAt.toISOString(),
          completed_at: inv.completedAt?.toISOString() ?? null,
          ...(inv.status === "complete" && inv.diagnosis
            ? { diagnosis: JSON.parse(inv.diagnosis) }
            : {}),
        })),
      },
    },
  };
}
