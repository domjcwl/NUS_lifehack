import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Testing on a phone means the dev server is reached by LAN IP, not
   * localhost, and Next gates cross-origin dev-asset requests on this list.
   * The addresses are per-machine and per-network, so they are listed rather
   * than guessed: add yours here when the phone stops picking up changes.
   *   172.20.10.x — phone hotspot   172.31.x — venue / home wifi
   */
  allowedDevOrigins: ["172.20.10.7", "172.31.38.250"],
};

export default nextConfig;
