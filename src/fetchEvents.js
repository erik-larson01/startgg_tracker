import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const tournamentPath = path.join(process.cwd(), "config", "tournaments.json");
const eventIdPath = path.join(process.cwd(), "data", "eventData.json");
const REQUEST_DELAY = 800;

// Rate limit delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Query for tournament details
const query = `query getEventId($slug: String) {
  event(slug: $slug) {
    id
    name
    numEntrants
    tournament {
      name
    }
  }
}`;

async function fetchId(slug) {
  // Fetch response using single graphQL endpoint
  try {
    const response = await fetch("https://api.start.gg/gql/alpha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        variables: { slug },
      }),
    });

    await delay(REQUEST_DELAY);
    const data = await response.json();
    if (data.data && data.data.event) {
      return data.data.event;
    }
  } catch (error) {
    console.log(`Error fetching ID for slug: ${slug}:`, error.message);
    throw error;
  }
}

export async function fetchEvents() {
  try {
    const allEvents = [];
    const tournamentData = JSON.parse(fs.readFileSync(tournamentPath, "utf-8"));

    const progressBar = new cliProgress.SingleBar(
      {
        format:
          "Fetching Events |{bar}| {percentage}% || {value}/{total} Events",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    progressBar.start(tournamentData.length, 0);

    for (const tournament of tournamentData) {
      // Create each slug using tournament details only
      const slug = tournament.substring("https://www.start.gg/".length);
      const event = await fetchId(slug);
      if (event) {
        allEvents.push({
          tournament: event.tournament.name,
          event: event.name,
          entrants: event.numEntrants,
          id: event.id,
          slug: slug,
        });
      } else {
        console.log(`No event found for slug: ${slug}`);
      }
      progressBar.increment();
    }
    progressBar.stop();
    fs.writeFileSync(eventIdPath, JSON.stringify(allEvents, null, 2));
    console.log(`Successfully fetched data for ${allEvents.length} events.`);
  } catch (error) {
    console.log("Error fetching events", error.message);
    throw error;
  }
}
