import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const key = process.env.STARTGG_API_KEY;
const tournamentPath = path.join(process.cwd(), "config", "tournaments.example.json");
const eventIdPath = path.join(process.cwd(), "data", "eventData.example.json");
const tournamentData = JSON.parse(fs.readFileSync(tournamentPath, "utf-8"));
const allEvents = [];

const query = `query getEventId($slug: String) {
  event(slug: $slug) {
    id
    name
    tournament {
      name
    }
  }
}`;

async function fetchId(slug) {
  const response = await fetch("https://api.start.gg/gql/alpha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      variables: { slug },
    }),
  });

  const data = await response.json();
  if (data.data && data.data.event) {
    return data.data.event;
  }
}

 export async function fetchEvents() {
  for (const tournament of tournamentData) {
    const slug = tournament.substring("https://www.start.gg/".length);
    const event = await fetchId(slug);
    if (event) {
      allEvents.push({
        tournament: event.tournament.name,
        event: event.name,
        id: event.id,
        slug: slug,
      });
    } else {
      console.log(`No event found for slug: ${slug}`);
    }
  }
  fs.writeFileSync(eventIdPath, JSON.stringify(allEvents, null, 2));
  console.log(`Successfully fetched data for ${allEvents.length} events.`);
}
