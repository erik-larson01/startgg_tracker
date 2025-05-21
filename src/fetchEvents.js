import fs from "fs";
import path from "path";
import { config } from 'dotenv';
config();

const key = process.env.STARTGG_API_KEY;

const tournamentPath = path.join(process.cwd(), 'config', 'tournaments.json'); //TODO change tournaments example to regular file
const eventIdPath = path.join(process.cwd(), 'data', 'eventIds.json')
const tournamentData = JSON.parse(fs.readFileSync(tournamentPath, 'utf-8'));
const allEvents = [];

const query = `query getEventId($slug: String) {
  event(slug: $slug) {
    id
    name
  }
}`

async function fetchId(slug) {
    const response = await fetch("https://api.start.gg/gql/alpha", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
            query,
            variables: { slug }
        })
    });

    const data = await response.json();

    if (data.data && data.data.event) {
        return data.data.event;
    }

}

async function parseAndFetch() {
  for (const tournament of tournamentData) {
    const slug = tournament.substring("https://www.start.gg/".length);
    const event = await fetchId(slug);
    if (event) {
        allEvents.push({
            id: event.id,
            name: event.name,
            slug: slug
        })
    }
  }
  fs.writeFileSync(eventIdPath, JSON.stringify(allEvents, null, 2));
  console.log("All events successfully written to eventIds.json")
}

parseAndFetch();