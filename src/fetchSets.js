import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const eventPath = path.join(process.cwd(), "data", "eventData.json");
const outputPath = path.join(process.cwd(), "data", "rawSets.json");
const REQUEST_DELAY = 800;

// Rate limit delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Query for all sets including values to determine winner
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
        displayScore
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
  try {
    // For all tournaments, fetch one page to accumulate the # of total sets across all events
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
      await delay(REQUEST_DELAY);

      const data = await response.json();
      const setsInfo = data.data.event.sets.pageInfo;
      total += setsInfo.total;
    }
  } catch (error) {
    console.log("Error getting total sets across all events:", error.message);
    throw error;
  }
  return total;
}

async function fetchAllSetsForEvent(id, perPage, progressBar) {
  let allSets = [];
  let page = 1;
  let totalPages = 1;
  let totalSets = 0;

  try {
    // Fetch all sets for an event, returning the total # of sets & the sets object
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
      // Destructure sets from the data response
      const { sets } = data.data.event;

      // Update total pages for while loop during first fetch
      totalPages = sets.pageInfo.totalPages;
      totalSets = sets.pageInfo.total;
      allSets.push(...sets.nodes);

      if (progressBar) {
        progressBar.increment(sets.nodes.length);
      }

      if (page <= totalPages) {
        await delay(REQUEST_DELAY);
      }
      page++;
    } while (page <= totalPages);
  } catch (error) {
    console.log(`Error fetching sets for eventID ${id}:`, error.message);
    throw error;
  }
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

  // Create a cli-progress progress bar object
  const progressBar = new cliProgress.SingleBar(
    {
      format:
        "Fetching Sets |{bar}| {percentage}% || {value}/{total} Sets || {tournament}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
      clearOnComplete: true,
      stopOnComplete: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(totalSetsAcrossAll, 0);

  for (let i = 0; i < eventIds.length; i++) {
    // Update the printed tournament if the prior tournament has all sets fetched
    progressBar.update({
      tournament: `${tournamentNames[i]} / ${eventNames[i]}`,
    });

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

    await delay(REQUEST_DELAY);
  }

  progressBar.stop();
  console.log(`${totalSetsAcrossAll} sets successfully fetched and saved to rawSets.json`);

  // Append totalSetsAcross all tournaments for easier JSON viewing
  const finalOutput = {
    totalSets: totalSetsAcrossAll,
    tournaments: combinedSets,
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
}
