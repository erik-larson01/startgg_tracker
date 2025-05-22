import fs from "fs";
import path from "path";

const key = process.env.STARTGG_API_KEY;
const eventPath = path.join(process.cwd(), "data", "eventData.example.json");
const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
const eventIds = eventData.map((event) => event.id);
const tournamentNames = eventData.map((event) => event.tournament);
const eventNames = eventData.map((event) => event.event);
const outputPath = path.join(process.cwd(), "data", "rawSets.example.json");
let perPage = 100;

const query = `query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo {
        totalPages
        total
      }
      nodes {
        id
        winnerId
        displayScore
        slots {
          entrant {
            id
            name
            participants {
              id
              gamerTag
            }
          }
        }
      }
    }
  }
}`;

async function fetchAllSetsForEvent(id, perPage) {
  let allSets = [];
  let page = 1;
  let totalPages = 1;
  let totalSets = 0;
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
    const { sets } = data.data.event;
    totalPages = sets.pageInfo.totalPages;
    totalSets = sets.pageInfo.total;
    allSets.push(...sets.nodes);

    page++;
  } while (page <= totalPages);

  return { totalSets, sets: allSets };
}

async function fetchSets() {
  let combinedSets = [];
  let totalSetsAcrossAll = 0;

  for (let i = 0; i < eventIds.length; i++) {
    console.log(
      `Fetching set data for tournament with name: ${tournamentNames[i]} and event: ${eventNames[i]}...`
    );
    const { totalSets, sets: allSets } = await fetchAllSetsForEvent(
      eventIds[i],
      perPage
    );

    totalSetsAcrossAll += totalSets;

    combinedSets.push({
      tournament: tournamentNames[i],
      event: eventNames[i],
      eventId: eventIds[i],
      totalSets,
      sets: allSets,
    });
  }
  const finalOutput = {
    totalSets: totalSetsAcrossAll,
    tournaments: combinedSets,
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
  console.log("All sets successfully written to rawSets.json");
}
