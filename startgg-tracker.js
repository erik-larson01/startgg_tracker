#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { fetchEvents } from "./src/fetchEvents.js";
import { fetchSets } from "./src/fetchSets.js";
import { fetchStandings } from "./src/fetchStandings.js";
import { processSets } from "./src/processSets.js";
import { exportResults } from "./src/exportResults.js";

const program = new Command();

const configDir = path.join(process.cwd(), "config");
const spreadsheetFile = path.join("config", "spreadsheetId.txt");
const playersPath = path.join("config", "players.json");
const tournamentsPath = path.join("config", "tournaments.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

program
  .name("startgg-tracker")
  .description("CLI tool to track players and tournaments from start.gg")
  .version("1.0.0");

program
  .command("init")
  .description(
    "Initializes config folder and create empty players and tournaments JSON files"
  )
  .action(() => {
    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log("Created config directory.");
      } else {
        console.log("Config directory already exists.");
      }

      if (!fs.existsSync(playersPath)) {
        fs.writeFileSync(playersPath, JSON.stringify([], null, 2));
        console.log("Created empty players.json.");
      } else {
        console.log("players.json already exists.");
      }

      if (!fs.existsSync(tournamentsPath)) {
        fs.writeFileSync(tournamentsPath, JSON.stringify([], null, 2));
        console.log("Created empty tournaments.json.");
      } else {
        console.log("tournaments.json already exists.");
      }

      console.log("Initialization complete.");
    } catch (error) {
      console.error("Error during init:", error.message);
      process.exit(1);
    }
  });

program
  .command("add player <gamerTag>")
  .description(
    "Adds a player to track, using their startGG username without their sponsor"
  )
  .action((gamerTag) => {
    if (!gamerTag.trim()) {
      console.log("Invalid gamerTag. It cannot be empty.");
      return;
    }

    if (!fs.existsSync(playersPath)) {
      console.log(
        "Config file players.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }
    const players = loadJson(playersPath);
    if (players.includes(gamerTag)) {
      console.log(`${gamerTag} is already tracked.`);
    } else {
      players.push(gamerTag);
      saveJson(playersPath, players);
      console.log(`${gamerTag} added to tracked players.`);
    }
  });

program
  .command("add tournament <url>")
  .description(
    "Adds a tournament URL, which should be a startGG link ending in the event name, such as .../ultimate-singles"
  )
  .action((url) => {
    if (!fs.existsSync(tournamentsPath)) {
      console.log(
        "Config file tournaments.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }

    const tournaments = loadJson(tournamentsPath);
    if (tournaments.includes(url)) {
      console.log("Tournament already exists.");
    } else {
      tournaments.push(url);
      saveJson(tournamentsPath, tournaments);
      console.log("Tournament added.");
    }
  });

program
  .command("view players")
  .description("Lists tracked players")
  .action(() => {
    if (!fs.existsSync(playersPath)) {
      console.log(
        "Config file players.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }
    const players = loadJson(playersPath);
    if (players.length === 0) {
      console.log("No players being tracked.");
    } else {
      console.log("Tracked Players:");
      players.forEach((player) => console.log(`- ${player}`));
    }
  });

program
  .command("view tournaments")
  .description("Lists tournament URLs")
  .action(() => {
    if (!fs.existsSync(tournamentsPath)) {
      console.log(
        "Config file tournaments.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }
    const tournaments = loadJson(tournamentsPath);
    if (tournaments.length === 0) {
      console.log("No tournaments added.");
    } else {
      console.log("Tournaments:");
      tournaments.forEach((url, index) => console.log(`${index + 1}. ${url}`));
    }
  });

program
  .command("delete player <gamerTag>")
  .description("Removes a player from the tracked player list")
  .action((gamerTag) => {
    if (!fs.existsSync(playersPath)) {
      console.log(
        "Config file players.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }
    let players = loadJson(playersPath);
    if (!players.includes(gamerTag)) {
      console.log(`${gamerTag} not found.`);
    } else {
      players = players.filter((player) => player !== gamerTag);
      saveJson(playersPath, players);
      console.log(`${gamerTag} removed.`);
    }
  });

program
  .command("delete tournament <urlOrIndex>")
  .description("Removes a tournament (by URL or index)")
  .action((urlOrIndex) => {
    if (!fs.existsSync(tournamentsPath)) {
      console.log(
        "Config file tournaments.json not found. Please run `startgg-tracker init` first."
      );
      process.exit(1);
    }

    let tournaments = loadJson(tournamentsPath);
    let removed;

    if (!isNaN(urlOrIndex)) {
      const index = parseInt(urlOrIndex) - 1;
      removed = tournaments.splice(index, 1);
    } else {
      removed = tournaments.filter((tourney) => tourney === urlOrIndex);
      tournaments = tournaments.filter((tourney) => tourney !== urlOrIndex);
    }

    if (removed.length > 0) {
      saveJson(tournamentsPath, tournaments);
      console.log("Tournament removed.");
    } else {
      console.log("Tournament not found.");
    }
  });

program
  .command("export")
  .description(
    "Exports processed results to Google Sheets (Must have Google credentials)"
  )
  .action(async () => {
    try {
      await exportResults();
      console.log("Export completed successfully.");
    } catch (error) {
      console.error("Error during export:", error.message);
    }
  });

program
  .command("set spreadsheet <spreadsheetId>")
  .description(
    "Set the Google Sheets spreadsheet ID for export (must be done before export)"
  )
  .action((spreadsheetId) => {
    if (!spreadsheetId || spreadsheetId.trim() === "") {
      console.log("Please provide a non-empty spreadsheet ID.");
      return;
    }

    fs.writeFileSync(spreadsheetFile, spreadsheetId.trim());
    console.log(`Spreadsheet ID saved: ${spreadsheetId}`);
  });

program
  .command("set-api-key <key>")
  .description("Set or update the STARTGG_API_KEY in the .env file")
  .action((key) => {
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";

    try {
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }

      const regex = /^STARTGG_API_KEY\s*=.*$/m;
      const newLine = `STARTGG_API_KEY="${key}"`;

      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        if (envContent && !envContent.endsWith("\n")) envContent += "\n";
        envContent += newLine + "\n";
      }

      fs.writeFileSync(envPath, envContent);
      console.log("STARTGG_API_KEY saved successfully in .env");
    } catch (error) {
      console.error("Failed to write to .env:", error.message);
      process.exit(1);
    }
  });

program
  .command("run")
  .description("Fetches and processes sets from Start.gg")
  .action(async () => {
    if (!fs.existsSync(playersPath) || !fs.existsSync(tournamentsPath)) {
      console.log(
        "Missing config files. Run init to initialize and set spreadsheet if exporting"
      );
      process.exit(1);
    }

    console.log("┌────────────────────────────────────────────┐");
    console.log("│    Start.gg Tournament Tracker v1.0.0      │");
    console.log("└────────────────────────────────────────────┘");
    console.log("Starting Start.gg tournament data fetch...");
    console.log();
    console.log("Fetching events...");
    try {
      await fetchEvents();
    } catch (error) {
      console.error("Error fetching events:", error.message);
      process.exit(1);
    }
    console.log("Fetching standings...");
    try {
      await fetchStandings();
    } catch (error) {
      console.error("Error fetching standings:", error.message);
      process.exit(1);
    }
    console.log("Fetching sets...");
    try {
      await fetchSets();
    } catch (error) {
      console.error("Error fetching sets:", error.message);
      process.exit(1);
    }
    try {
      processSets();
    } catch (error) {
      console.error("Error processing sets:", error.message);
      process.exit(1);
    }
    console.log(
      "Done! See data/results.json or run export to output to Google Sheets."
    );
  });

program.parse(process.argv);
