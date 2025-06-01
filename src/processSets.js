import fs from "fs";
import path from "path";

const playersPath = path.join(process.cwd(), "config", "players.json");
const rawSetsPath = path.join(process.cwd(), "data", "rawSets.json");
const standingsPath = path.join(process.cwd(), "data", "standings.json");
const outputPath = path.join(process.cwd(), "data", "results.json");

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

function addPlacement(userData, standings, trackedPlayerMap) {
  for (const tournament of standings) {
    const tournamentName = tournament.tournament;
    const totalEntrants = tournament.totalEntrants;

    for (const entry of tournament.standings) {
      const placement = entry.placement;
      const entrant = entry.entrant;

      if (
        !entrant ||
        !entrant.participants ||
        entrant.participants.length === 0
      )
        continue;

      const participant = entrant.participants[0];

      if (!participant.user || !participant.user.id) continue;

      const userId = participant.user.id;

      if (!userData[userId]) continue;
      userData[userId].placements.push({
        tournament: tournamentName,
        placement: placement + " / " + totalEntrants,
      });
    }
  }
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
  const trackedPlayers = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const rawSets = JSON.parse(fs.readFileSync(rawSetsPath, "utf-8"));
  const standings = JSON.parse(fs.readFileSync(standingsPath, "utf-8"));
  const allSets = rawSets.tournaments.flatMap((tournament) => tournament.sets);
  const allSlots = allSets.flatMap((set) => set.slots);

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
    userData[userId] = {
      gamerTag,
      totalSets: 0,
      wins: 0,
      losses: 0,
      headToHead: {},
      placements: [],
    };
  }

  for (const set of allSets) {
    const [slotOne, slotTwo] = set.slots;

    const entrantId1 = slotOne.entrant.id;
    const entrantId2 = slotTwo.entrant.id;

    if (!isValidSlot(slotOne) || !isValidSlot(slotTwo)) {
      continue;
    }

    const userId1 = entrantIdToUserId.get(entrantId1);
    const userId2 = entrantIdToUserId.get(entrantId2);

    const tag1 = trackedPlayerMap.get(userId1);
    const tag2 = trackedPlayerMap.get(userId2);

    const winnerEntrantId = set.winnerId;
    const winnerUserId = entrantIdToUserId.get(winnerEntrantId);

    if (!userData[userId1] && !userData[userId2]) continue;

    if (userData[userId1]) {
      const isWinner = userId1 === winnerUserId;
      userData[userId1][isWinner ? "wins" : "losses"]++;
      userData[userId1].totalSets++;

      const opponentOf1 =
        trackedPlayerMap.get(userId2) ||
        slotTwo.entrant.participants[0].gamerTag;

      if (!userData[userId1].headToHead[userId2]) {
        userData[userId1].headToHead[userId2] = {
          gamerTag: opponentOf1,
          wins: 0,
          losses: 0,
        };
      }

      userData[userId1].headToHead[userId2].gamerTag = opponentOf1;
      userData[userId1].headToHead[userId2][isWinner ? "wins" : "losses"]++;
    }

    if (userData[userId2]) {
      const isWinner = userId2 === winnerUserId;
      userData[userId2][isWinner ? "wins" : "losses"]++;
      userData[userId2].totalSets++;

      const opponentOf2 =
        trackedPlayerMap.get(userId1) ||
        slotOne.entrant.participants[0].gamerTag;

      if (!userData[userId2].headToHead[userId1]) {
        userData[userId2].headToHead[userId1] = {
          gamerTag: opponentOf2,
          wins: 0,
          losses: 0,
        };
      }

      userData[userId2].headToHead[userId1].gamerTag = opponentOf2;
      userData[userId2].headToHead[userId1][isWinner ? "wins" : "losses"]++;
    }
  }

  addPlacement(userData, standings, trackedPlayerMap);
  let json = JSON.stringify(userData, null, 2);
  json = json.replace(
    /{\n\s*"gamerTag": "(.*?)",\n\s*"wins": (\d+),\n\s*"losses": (\d+)\n\s*}/g,
    '{ "gamerTag": "$1", "wins": $2, "losses": $3 }'
  );
  json = json.replace(
    /{\n\s*"tournament": "(.*?)",\n\s*"placement": "(.*?)"\n\s*}/g,
    '{ "tournament": "$1", "placement": "$2" }'
  );

  fs.writeFileSync(outputPath, json);
  console.log(
    `Successfully processed all sets from ${trackedPlayerMap.size} users into results.json.`
  );
}
