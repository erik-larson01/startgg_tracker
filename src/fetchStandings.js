import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const eventPath = path.join(process.cwd(), "data", "eventData.json");
const outputPath = path.join(process.cwd(), "data", "standings.json");
const REQUEST_DELAY = 800;

// Rate limit delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Query to get standings and a participant's name and ID
const query = `query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    standings(query: {
      perPage: $perPage,
      page: $page
    }){
      nodes {
        placement
        entrant {
          id
          name
          participants {
            gamerTag
            user {
              id
            }
          }
        }
      }
    }
  }
}`;

async function fetchAllStandingsForEvent(
  id,
  perPage,
  totalEntrants,
  label,
  progressBar
) {
  let allStandings = [];
  let page = 1;
  const totalPages = Math.ceil(totalEntrants / perPage);

  try {
    // Fetch all standings for a single event, including the total entrants of that event
    do {
      const response = await fetch("https://api.start.gg/gql/alpha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          query,
          variables: { eventId: id, page, perPage },
        }),
      });

      await delay(REQUEST_DELAY);

      const data = await response.json();
      const { standings } = data.data.event;
      allStandings.push(...standings.nodes);

      page++;

      const nodesCount = standings.nodes.length;

      if (progressBar) {
        progressBar.increment(nodesCount, { tournament: label });
      }
    } while (page <= totalPages);
  } catch (error) {
    console.log(
      `Error fetching standings for event with ID: ${id}, check eventData.json`,
      error.message
    );
    throw error;
  }
  return { totalEntrants, standings: allStandings };
}

export async function fetchStandings() {
  try {
    const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
    const eventIds = eventData.map((event) => event.id);
    const tournamentNames = eventData.map((event) => event.tournament);
    const tournamentEntrants = eventData.map((event) => event.entrants);
    const eventNames = eventData.map((event) => event.event);
    const perPage = 100;
    const totalEntrantsAll = tournamentEntrants.reduce(
      (sum, curr) => sum + curr,
      0
    );

    const progressBar = new cliProgress.SingleBar(
      {
        format:
          "Fetching Standings |{bar}| {percentage}% || {value}/{total} Entrants || {tournament}",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    progressBar.start(totalEntrantsAll, 0);
    let combinedPlacements = [];

    for (let i = 0; i < eventIds.length; i++) {
      let entrantsForTourney = tournamentEntrants[i];
      const label = `${tournamentNames[i]} / ${eventNames[i]}`;
      // Fetch stats per tournament
      const { totalEntrants, standings: allStandings } =
        await fetchAllStandingsForEvent(
          eventIds[i],
          perPage,
          entrantsForTourney,
          label,
          progressBar
        );

      combinedPlacements.push({
        tournament: tournamentNames[i],
        event: eventNames[i],
        eventId: eventIds[i],
        totalEntrants,
        standings: allStandings,
      });
      await delay(REQUEST_DELAY);
    }
    progressBar.stop();

    fs.writeFileSync(outputPath, JSON.stringify(combinedPlacements, null, 2));
    console.log(`Successfully fetched data for ${totalEntrantsAll} entrants.`);
  } catch (error) {
    console.log("Fatal error fetching standings:", error.message);
  }
}
