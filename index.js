import { config } from "dotenv";
config();

import { fetchEvents } from "./src/fetchEvents.js";
import { fetchSets } from "./src/fetchSets.js";
import { fetchStandings } from "./src/fetchStandings.js";
import { processSets } from "./src/processSets.js";
import {exportResults} from "./src/exportResults.js"

async function main() {
  try {
  console.log("┌────────────────────────────────────────────┐");
  console.log("│     Start.gg Tournament Tracker v1.0       │");
  console.log("└────────────────────────────────────────────┘");

  console.log("Starting Start.gg tournament data fetch...");
  console.log();
  console.log("Fetching event data for all tournaments...");
  await fetchEvents();
  console.log("\nFetching standing data for all tournaments...\n");
  await fetchStandings();
  console.log(`All standings successfully fetched and saved to standings.json`);
  await fetchSets();
  console.log("\nProcessing sets in rawSets.json...");
  await processSets();
  console.log("\nDone! All data successfully fetched and processed.\n");
  console.log("View results.json for full player stats and tournament placements.")
  await exportResults();
  } catch (error) {
    "Error caught! Please restart the program."
    process.exit(1);
  }
}

main();
