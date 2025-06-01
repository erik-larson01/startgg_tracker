import { google } from "googleapis";
import fs from "fs";
import path from "path";

async function getAuthClient() {
  try {
    const credentialsPath = path.join(process.cwd(), "credentials.json");

    if (fs.existsSync(credentialsPath)) {
      throw new Error(`Credentials.json not found at ${credentialsPath}`);
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();
    console.log("Google Auth client authenticated successfully");

    return client;
  } catch (error) {
    console.log("Error creating google auth client:", error.message);
    throw error;
  }
}

export async function createSheetsClient() {
  try {
    const authClient = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    console.log("Google Sheets client created successfully");
    return sheets;
  } catch (error) {
    console.log("Error creating Google Sheets client:", error.message);
    throw error;
  }
}
