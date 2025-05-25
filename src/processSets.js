import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const playersPath = path.join(process.cwd(), "config", "players.example.json");
const trackedPlayers = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
const rawSetsPath = path.join(process.cwd(), "data", "rawSets.example.json");
const rawSets = JSON.parse(fs.readFileSync(rawSetsPath, "utf-8"));
const outputPath = path.join(process.cwd(), "data", "results.example.json");

const allSets = rawSets.tournaments.flatMap(tournament => tournament.sets);
const allSlots = allSets.flatMap(set => set.slots);

function getUserIds(trackedPlayers, allSlots) {
    const playerMap = new Map();
    for (const player of trackedPlayers) {
        const normalizedInput = player.toLowerCase().trim();
        for (const slot of allSlots) {
            const participant = slot.entrant.participants[0];
            const normalizedTag = participant.gamerTag.toLowerCase().trim();

            if ((normalizedTag === normalizedInput)) {
                playerMap.set(participant.gamerTag, participant.id);
                break;
            }
        }
    }
    return playerMap;
}

const playerMap = getUserIds(trackedPlayers, allSlots);
