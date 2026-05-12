import { execFile } from "child_process";
import dns from "dns";
import mongoose from "mongoose";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const WINDOWS_DNS_COMMAND = [
  "& { param($name, $type)",
  "$ErrorActionPreference = 'Stop'",
  "$records = @(Resolve-DnsName -Name $name -Type $type | Where-Object { $_.Type -eq $type })",
  "$records | ConvertTo-Json -Compress",
  "}",
].join("; ");

const parseJsonRecords = (stdout) => {
  const output = stdout.trim();

  if (!output) {
    return [];
  }

  const records = JSON.parse(output);
  return Array.isArray(records) ? records : [records];
};

const resolveWithWindowsDns = async (hostname, rrtype) => {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    WINDOWS_DNS_COMMAND,
    hostname,
    rrtype,
  ]);

  const records = parseJsonRecords(stdout);

  if (rrtype === "SRV") {
    return records.map((record) => ({
      name: record.NameTarget,
      port: record.Port,
      priority: record.Priority,
      weight: record.Weight,
    }));
  }

  if (rrtype === "TXT") {
    return records.map((record) => record.Strings);
  }

  return records;
};

const shouldUseWindowsDnsFallback = (hostname, rrtype) =>
  process.platform === "win32" &&
  typeof hostname === "string" &&
  hostname.endsWith(".mongodb.net") &&
  ["SRV", "TXT"].includes(rrtype);

const installWindowsMongoSrvDnsFallback = () => {
  if (dns.promises.__windowsMongoSrvDnsFallbackInstalled) {
    return;
  }

  const originalResolve = dns.promises.resolve.bind(dns.promises);

  dns.promises.resolve = async (hostname, rrtype, ...args) => {
    const normalizedType = String(rrtype || "").toUpperCase();

    if (shouldUseWindowsDnsFallback(hostname, normalizedType)) {
      return resolveWithWindowsDns(hostname, normalizedType);
    }

    return originalResolve(hostname, rrtype, ...args);
  };

  dns.promises.__windowsMongoSrvDnsFallbackInstalled = true;
};

const getConnectionHint = (error) => {
  const message = error?.message || "";

  if (message.includes("querySrv")) {
    return [
      "",
      "Hint: The MongoDB Atlas SRV DNS lookup failed. Check your DNS settings.",
    ].join("\n");
  }

  if (
    message.includes("Could not connect to any servers") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED")
  ) {
    return [
      "",
      "Hint: Atlas was reachable by name, but the database connection failed.",
      "Make sure your current public IP is allowed in Atlas Network Access",
      "and that your network allows outbound TCP connections to port 27017.",
    ].join("\n");
  }

  return "";
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in the environment");
  }

  if (process.env.MONGODB_URI.startsWith("mongodb+srv://")) {
    installWindowsMongoSrvDnsFallback();
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    error.message = `${error.message}${getConnectionHint(error)}`;
    throw error;
  }
};

export default connectDB;
