import { fetchWithBackoff } from "../utils";

const USER_AGENT = "WhatsFiled whatsfiled@gmail.com";

class EdgarFetchClient {
  async fetch(url: string): Promise<string> {
    const response = await fetchWithBackoff(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Encoding": "gzip, deflate",
        },
      },
      {
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 60000,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    return response.text();
  }
}

export default new EdgarFetchClient();
