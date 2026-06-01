import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Unrelated lockfiles exist in parent directories; pin the file-tracing root
  // to this project so Next infers the workspace root correctly.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
