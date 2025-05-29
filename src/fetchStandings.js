import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const eventPath = path.join(process.cwd(), "data", "eventData.example.json");
const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
const eventIds = eventData.map((event) => event.id);
const tournamentNames = eventData.map((event) => event.tournament);
const tournamentEntrants = eventData.map((event) => event.entrants);
const eventNames = eventData.map((event) => event.event);
const outputPath = path.join(process.cwd(), "data", "standings.example.json");
let perPage = 100;

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

export async function fetchAllStandingsForEvent(id, perPage, totalEntrants) {
  let allStandings = [];
  let page = 1;
  const totalPages = Math.ceil(totalEntrants / perPage);

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

    const data = await response.json();
    const { standings } = data.data.event;
    allStandings.push(...standings.nodes);

    page++;
  } while (page <= totalPages);

  return { totalEntrants, standings: allStandings };
}

export async function fetchStandings() {
  let combinedPlacements = [];
  for (let i = 0; i < eventIds.length; i++) {
    console.log(
      `\nFetching standings data for tournament with name: ${tournamentNames[i]} and event: ${eventNames[i]}...`
    );
    let entrantsForTourney = tournamentEntrants[i];
    const { totalEntrants, standings: allStandings } =
      await fetchAllStandingsForEvent(eventIds[i], perPage, entrantsForTourney);

    combinedPlacements.push({
      tournament: tournamentNames[i],
      event: eventNames[i],
      eventId: eventIds[i],
      totalEntrants,
      standings: allStandings,
    });
  }
  fs.writeFileSync(outputPath, JSON.stringify(combinedPlacements, null, 2));
  console.log(`All standings successfully fetched and saved to standings.json`);
}
