import { config } from "dotenv";
config();

import { fetchEvents } from "./src/fetchEvents.js";
import {fetchSets} from "./src/fetchSets.js";

async function main () {
    await fetchEvents();
    await fetchSets();
}

main();
