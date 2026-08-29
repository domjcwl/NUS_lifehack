/**
 * Is the knowledge service up, and did it load its data?
 *
 * One fetch from the browser console — or from the phone that is about to be
 * demoed — tells you whether answers will be grounded or will come from the
 * fallback in ../route.ts. Cheaper than discovering it mid-question.
 */

import { NextResponse } from "next/server";

import { CHATBOT_URL, ChatbotUnavailable, health } from "@/lib/chatbot";

export async function GET() {
  try {
    return NextResponse.json({ reachable: true, url: CHATBOT_URL, ...(await health()) });
  } catch (err) {
    const message =
      err instanceof ChatbotUnavailable || err instanceof Error ? err.message : "unreachable";
    /* 200, not 503: this endpoint reports a fact, and "the service is down" is a
       successful report. A non-2xx here would look like this route is broken. */
    return NextResponse.json({ reachable: false, url: CHATBOT_URL, error: message });
  }
}
