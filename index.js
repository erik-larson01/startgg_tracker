import { config } from "dotenv";
config();

import { fetchEvents } from "./src/fetchEvents.js";
import {fetchSets} from "./src/fetchSets.js";
import { processSets } from "./src/processSets.js";


async function main () {
    console.log("Starting Start.gg tournament data fetch...");
    console.log();
    console.log("Fetching event data for all tournaments...");
    await fetchEvents();
    await fetchSets();
    console.log("\nProcessing sets in rawSets.json...")
    await processSets();
}

main();
