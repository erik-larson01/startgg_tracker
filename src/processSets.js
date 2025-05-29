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

const allSets = rawSets.tournaments.flatMap((tournament) => tournament.sets);
const allSlots = allSets.flatMap((set) => set.slots);

function getUserIds(trackedPlayers, allSlots) {
  const playerMap = new Map();
  for (const player of trackedPlayers) {
    const normalizedInput = player.toLowerCase().trim();
    for (const slot of allSlots) {
      if (!isValidSlot(slot)) {
        continue;
      }
      const participant = slot.entrant.participants[0];
      const normalizedTag = participant.gamerTag.toLowerCase().trim();

      if (normalizedTag === normalizedInput) {
        playerMap.set(participant.user.id, participant.gamerTag);
        break;
      }
    }
  }
  return playerMap;
}

function isValidSlot(slot) {
  return (
    slot.entrant &&
    slot.entrant.participants &&
    slot.entrant.participants.length > 0 &&
    slot.entrant.participants[0].user
  );
}

export function processSets() {
  const entrantIdToUserId = new Map();
  for (const set of allSets) {
    for (const slot of set.slots) {
      if (!isValidSlot(slot)) {
        continue;
      }
      const entrantId = slot.entrant.id;
      const userId = slot.entrant.participants[0].user.id;
      entrantIdToUserId.set(entrantId, userId);
    }
  }

  const trackedPlayerMap = getUserIds(trackedPlayers, allSlots);
  const userData = {};
  for (const [userId, gamerTag] of trackedPlayerMap) {
    userData[gamerTag] = {
      userId,
      totalSets: 0,
      wins: 0,
      losses: 0,
      headToHead: {},
      // placements: [], later implementation
    };
  }

  for (const set of allSets) {
    const [slotOne, slotTwo] = set.slots;

    const entrantId1 = slotOne.entrant.id;
    const entrantId2 = slotTwo.entrant.id;

    if (!isValidSlot(slotOne) || (!isValidSlot(slotTwo))) {
      continue;
    }

    const userId1 = entrantIdToUserId.get(entrantId1);
    const userId2 = entrantIdToUserId.get(entrantId2);

    const tag1 = trackedPlayerMap.get(userId1);
    const tag2 = trackedPlayerMap.get(userId2);

    const opponentOf1 = slotTwo.entrant.participants[0].gamerTag;
    const opponentOf2 = slotOne.entrant.participants[0].gamerTag;

    const winnerEntrantId = set.winnerId;
    const winnerUserId = entrantIdToUserId.get(winnerEntrantId);

    if (!tag1 && !tag2) continue;

    if (tag1) {
      const isWinner = userId1 === winnerUserId;
      userData[tag1][isWinner ? "wins" : "losses"]++;
      userData[tag1].totalSets++;

      if (!userData[tag1].headToHead[opponentOf1]) {
        userData[tag1].headToHead[opponentOf1] = { wins: 0, losses: 0 };
      }
      userData[tag1].headToHead[opponentOf1][isWinner ? "wins" : "losses"]++;
    }

    if (tag2) {
      const isWinner = userId2 === winnerUserId;
      userData[tag2][isWinner ? "wins" : "losses"]++;
      userData[tag2].totalSets++;

      if (!userData[tag2].headToHead[opponentOf2]) {
        userData[tag2].headToHead[opponentOf2] = { wins: 0, losses: 0 };
      }
      userData[tag2].headToHead[opponentOf2][isWinner ? "wins" : "losses"]++;
    }
  }
  
  let json = JSON.stringify(userData, null, 2);
  json = json.replace(/{\n\s*"wins": (\d+),\n\s*"losses": (\d+)\n\s*}/g, '{ "wins": $1, "losses": $2 }');

  fs.writeFileSync(outputPath, json);
  console.log(`Successfully processed all sets from ${trackedPlayerMap.size} users into results.json.`);
}
