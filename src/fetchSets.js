import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const eventPath = path.join(process.cwd(), "data", "eventData.json");
const outputPath = path.join(process.cwd(), "data", "rawSets.json");

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
        slots {
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
  }
}`;

async function getTotalSetsForAllEvents(eventIds) {
  let total = 0;

  for (let i = 0; i < eventIds.length; i++) {
    const response = await fetch("https://api.start.gg/gql/alpha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          eventId: eventIds[i],
          page: 1,
          perPage: 1,
        },
      }),
    });

    const data = await response.json();
    const setsInfo = data.data.event.sets.pageInfo;
    total += setsInfo.total;
  }

  return total;
}

 async function fetchAllSetsForEvent(id, perPage, progressBar) {
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

    if (progressBar) {
      progressBar.increment(sets.nodes.length);
    }
    page++;
  } while (page <= totalPages);

  return { totalSets, sets: allSets };
}

 export async function fetchSets() {
  const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
  const eventIds = eventData.map((event) => event.id);
  const tournamentNames = eventData.map((event) => event.tournament);
  const eventNames = eventData.map((event) => event.event);
  const perPage = 100;
  let combinedSets = [];
  let totalSetsAcrossAll = await getTotalSetsForAllEvents(eventIds);

  const progressBar = new cliProgress.SingleBar(
    {
      format: "Fetching Sets |{bar}| {percentage}% || {value}/{total} Sets || {tournament}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(totalSetsAcrossAll, 0);

  for (let i = 0; i < eventIds.length; i++) {
    progressBar.update({ tournament: `${tournamentNames[i]} / ${eventNames[i]}` });
    const { totalSets, sets: allSets } = await fetchAllSetsForEvent(
      eventIds[i],
      perPage,
      progressBar
    );

    combinedSets.push({
      tournament: tournamentNames[i],
      event: eventNames[i],
      eventId: eventIds[i],
      totalSets,
      sets: allSets,
    });
  }

  progressBar.stop();
  console.log();
  console.log(`All sets successfully fetched and saved to rawSets.json`);

  const finalOutput = {
    totalSets: totalSetsAcrossAll,
    tournaments: combinedSets,
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
}
