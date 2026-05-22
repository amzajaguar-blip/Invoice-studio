import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://6043088cbeec5f8f8735893066ebcd1a@o4511419006189568.ingest.de.sentry.io/4511419021459536",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information in the console while you're setting up Sentry.
  debug: false,
});
