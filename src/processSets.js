import fs from "fs";
import path from "path";

const playersPath = path.join(process.cwd(), "config", "players.json");
const rawSetsPath = path.join(process.cwd(), "data", "rawSets.json");
const standingsPath = path.join(process.cwd(), "data", "standings.json");
const outputPath = path.join(process.cwd(), "data", "results.json");

// Create a map of all tracked players to their respective user IDs
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

// Append placement to each user using trackedPlayerMap
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
    slot.entrant.participants[0].user &&
    slot.entrant.participants[0].user.id
  );
}


// Add additional stats to userData object
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
    player.bestPlacement = Math.min(...placements);
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

      // Update head to head record based on wins vs losses
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
  try {
  const trackedPlayers = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const rawSets = JSON.parse(fs.readFileSync(rawSetsPath, "utf-8"));
  const standings = JSON.parse(fs.readFileSync(standingsPath, "utf-8"));

  // Use flatmap to extract just sets and just slots from the raw data
  const allSets = rawSets.tournaments.flatMap((tournament) => tournament.sets);
  const allSlots = allSets.flatMap((set) => set.slots);

  // Create a map of entrantIds to user Ids to extract the winner from every set
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

  // Initialize userData object for all tracked players
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
      bestPlacement: null,
      worstPlacement: null,
      top8Count: 0,
      headToHead: {},
      placements: [],
    };
  }

  for (const set of allSets) {
    const [slotOne, slotTwo] = set.slots;

    if (!isValidSlot(slotOne) || !isValidSlot(slotTwo)) {
      continue;
    }

    const entrantId1 = slotOne.entrant.id;
    const entrantId2 = slotTwo.entrant.id;

    // Extract userIds from created map
    const userId1 = entrantIdToUserId.get(entrantId1);
    const userId2 = entrantIdToUserId.get(entrantId2);

    // Extract tags from trackedPlayerMap
    const tag1 = trackedPlayerMap.get(userId1);
    const tag2 = trackedPlayerMap.get(userId2);

    const winnerEntrantId = set.winnerId;

    // Get the userId of the winner
    const winnerUserId = entrantIdToUserId.get(winnerEntrantId);

    // If no players are tracked, move to next set
    if (!userData[tag1] && !userData[tag2]) continue;


    // Update results for tracked player if in slot 1
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

    // Update results for tracked player if in slot 2
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


  // Use regular expressions to format h2h and placements on one line
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
} catch (error) {
  console.log("Error processing sets:" , error.message);
  throw error;
}
}
