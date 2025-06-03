import fs from "fs";
import path from "path";
import { createSheetsClient } from "./googleAuth.js";
const resultsPath = path.join(process.cwd(), "data", "results.json");

// Replace your spreadsheet ID here
const spreadsheetId = "1tnBu5hQesCq7uQdRxMJC_oFFSMIzSb9Y0X9S3ZLJPb0";

const tabs = {
  summary: "Player Summary",
  h2h: "Head-to-Head",
  placements: "Placements",
  playerMatches: "Player Matches",
};

function getAllTrackedPlayers(results) {
  return Object.keys(results);
}

function generatePlayerSummary(results) {
  const players = getAllTrackedPlayers(results);
  const headers = [
    "Player Name",
    "Total Sets",
    "Wins",
    "Losses",
    "Win Rate",
    "Total Opponents",
    "Positive Records",
    "Even Records",
    "Negative Records",
    "Events Attended",
    "Avg Placement",
    "Best Placement",
    "Worst Placement",
    "Top 8 Count",
  ];

  // Creates the first row of headers using nested arrays
  const data = [headers];

  // For each player, append a row of their individual stats
  players.forEach((playerName) => {
    const player = results[playerName];
    const row = [
      playerName,
      player.totalSets,
      player.wins,
      player.losses,
      player.winRate,
      player.totalOpponents,
      player.positiveRecords,
      player.evenRecords,
      player.negativeRecords,
      player.eventsAttended,
      player.avgPlacement,
      player.bestPlacement,
      player.worstPlacement,
      player.top8Count,
    ];
    data.push(row);
  });

  return data;
}

function getPlacementData(results) {
  const trackedPlayers = getAllTrackedPlayers(results);
  const headers = ["Tournament", "Entrants", ...trackedPlayers];
  const data = [headers];

  // Create a set of all unique tournaments
  const tournamentSet = new Set();
  for (const playerName of trackedPlayers) {
    for (const placement of results[playerName].placements) {
      tournamentSet.add(placement.tournament);
    }
  }

  const tournaments = Array.from(tournamentSet);

  // For all tournaments, add a row of totalEntrants and each player;s placements
  for (const tourney of tournaments) {
    let totalEntrants = null;
    const row = [tourney];

    // For every player, find their placement, N/A if did not attend
    for (const playerName of trackedPlayers) {
      const player = results[playerName];
      let placementEntry = null;

      for (const place of player.placements) {
        if (place.tournament === tourney) {
          placementEntry = place;

          // Update that tournament's totalEntrants the first time it is seen
          if (totalEntrants === null) {
            totalEntrants = parseInt(placementEntry.placement.split(" / ")[1]);
          }
          break;
        }
      }

      // If we found an entry, extract the placement
      if (placementEntry) {
        const placeNumber = parseInt(placementEntry.placement.split(" / ")[0]);
        row.push(placeNumber);
      } else {
        row.push("N/A");
      }
    }

    // Add total entrants after Tourney Names and add a new row
    row.splice(1, 0, totalEntrants);
    data.push(row);
  }

  return data;
}

async function setupSheets(sheets) {
  // Create sheets and update their names
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const existingSheets = spreadsheet.data.sheets;
    const existingSheetsTitles = existingSheets.map(
      (spreadsheet) => spreadsheet.properties.title
    );

    // Acculumuate requests for batchUpdate
    const requests = [];

    // Replace "Sheet1" with "Player Summary"
    if (!existingSheetsTitles.includes(tabs.summary)) {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: existingSheets[0].properties.sheetId,
            title: tabs.summary,
          },
          fields: "title",
        },
      });
    }

    const remainingTitles = [tabs.playerMatches, tabs.h2h, tabs.placements];

    // Create Player Matches, H2H, Placements Sheets
    remainingTitles.forEach((tabTitle) => {
      if (!existingSheetsTitles.includes(tabTitle)) {
        requests.push({
          addSheet: {
            properties: {
              title: tabTitle,
            },
          },
        });
      }
    });

    // Update the spreadsheet
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { requests },
      });
    }

    console.log("Sheets setup completed");
  } catch (error) {
    console.log("Error setting up sheets:", error.message);
    throw error;
  }
}

async function writeDataToSheet(sheets, sheetName, data) {
  // Write raw data in cell A1
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      resource: {
        values: data,
      },
    });
    console.log(`Data written to ${sheetName} sheet`);
  } catch (error) {
    console.log(`Error writing data to ${sheetName}`, error.message);
    throw error;
  }
}

export async function exportResults() {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const sheets = await createSheetsClient();
  await setupSheets(sheets);
  const summaryData = generatePlayerSummary(results);
  await writeDataToSheet(sheets, tabs.summary, summaryData);
  const placementData = getPlacementData(results);
  await writeDataToSheet(sheets, tabs.placements, placementData);
}
