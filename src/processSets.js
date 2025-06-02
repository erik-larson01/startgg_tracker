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
      const gamerTag = trackedPlayerMap.get(userId);

      if (!userData[gamerTag]) continue;
      userData[gamerTag].placements.push({
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

function finalizeStats(userData) {
  for (const tag in userData) {
    const player = userData[tag];

    if (player.totalSets != 0) {
      player.winRate = +(player.wins / player.totalSets).toFixed(2);
    }

    const placements = player.placements.map((placement) => {
      const numerator = Number(placement.placement.split("/")[0].trim());
      return numerator;
    });

    player.eventsAttended = placements.length;
    player.bestPlaceMent = Math.min(...placements);
    player.worstPlacement = Math.max(...placements);

    let top8Count = 0;
    for (const place of placements) {
      if (place <= 8) {
        top8Count++;
      }
    }

    player.top8Count = top8Count;
    if (placements.size != 0) {
      const totalPlacements = placements.reduce((sum, placement) => sum + placement, 0);
      player.avgPlacement = Number((totalPlacements / player.eventsAttended).toFixed(2));
    }
    const headToHead = player.headToHead;
    let pos = 0,
      neg = 0,
      even = 0;

    for (const opponent in headToHead) {
      const record = headToHead[opponent];
      if (record.wins > record.losses) pos++;
      else if (record.wins === record.losses) even++;
      else neg++;
    }

    player.totalOpponents = Object.keys(headToHead).length;
    player.positiveRecords = pos;
    player.evenRecords = even;
    player.negativeRecords = neg;
  }
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
    userData[gamerTag] = {
      userId,
      totalSets: 0,
      wins: 0,
      losses: 0,
      winRate: 0.0,
      totalOpponents: 0,
      positiveRecords: 0,
      evenRecords: 0,
      negativeRecords: 0,
      eventsAttended: 0,
      avgPlacement: 0.0,
      bestPlaceMent: null,
      worstPlacement: null,
      top8Count: 0,
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

    if (!userData[tag1] && !userData[tag2]) continue;

    if (userData[tag1]) {
      const isWinner = userId1 === winnerUserId;
      userData[tag1][isWinner ? "wins" : "losses"]++;
      userData[tag1].totalSets++;

      const opponentOf1 =
        trackedPlayerMap.get(userId2) ||
        slotTwo.entrant.participants[0].gamerTag;

      if (!userData[tag1].headToHead[opponentOf1]) {
        userData[tag1].headToHead[opponentOf1] = { wins: 0, losses: 0 };
      }
      userData[tag1].headToHead[opponentOf1][isWinner ? "wins" : "losses"]++;
    }

    if (userData[tag2]) {
      const isWinner = userId2 === winnerUserId;
      userData[tag2][isWinner ? "wins" : "losses"]++;
      userData[tag2].totalSets++;

      const opponentOf2 =
        trackedPlayerMap.get(userId1) ||
        slotOne.entrant.participants[0].gamerTag;

      if (!userData[tag2].headToHead[opponentOf2]) {
        userData[tag2].headToHead[opponentOf2] = { wins: 0, losses: 0 };
      }

      userData[tag2].headToHead[opponentOf2][isWinner ? "wins" : "losses"]++;
    }
  }

  addPlacement(userData, standings, trackedPlayerMap);
  finalizeStats(userData);

  let json = JSON.stringify(userData, null, 2);
  json = json.replace(
    /{\n\s*"wins": (\d+),\n\s*"losses": (\d+)\n\s*}/g,
    '{ "wins": $1, "losses": $2 }'
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
