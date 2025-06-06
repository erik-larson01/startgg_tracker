import fs from "fs";
import path from "path";
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

async function fetchAllStandingsForEvent(id, perPage, totalEntrants) {
  let allStandings = [];
  let page = 1;
  const totalPages = Math.ceil(totalEntrants / perPage);

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
  } while (page <= totalPages);

  return { totalEntrants, standings: allStandings };
}

export async function fetchStandings() {
  const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
  const eventIds = eventData.map((event) => event.id);
  const tournamentNames = eventData.map((event) => event.tournament);
  const tournamentEntrants = eventData.map((event) => event.entrants);
  const eventNames = eventData.map((event) => event.event);

  const perPage = 100;
  let combinedPlacements = [];
  for (let i = 0; i < eventIds.length; i++) {
    let entrantsForTourney = tournamentEntrants[i];
    // Fetch stats per tournament
    const { totalEntrants, standings: allStandings } =
      await fetchAllStandingsForEvent(eventIds[i], perPage, entrantsForTourney);

    combinedPlacements.push({
      tournament: tournamentNames[i],
      event: eventNames[i],
      eventId: eventIds[i],
      totalEntrants,
      standings: allStandings,
    });
     await delay(REQUEST_DELAY);
  }
  fs.writeFileSync(outputPath, JSON.stringify(combinedPlacements, null, 2));
}
