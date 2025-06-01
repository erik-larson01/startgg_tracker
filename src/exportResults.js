import fs from "fs";
import path from "path"
import { createSheetsClient } from "./src/googleAuth";
const resultsPath = path.join(process.cwd(), "data", "results.json");
const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));

const spreadSheetId = "1tnBu5hQesCq7uQdRxMJC_oFFSMIzSb9Y0X9S3ZLJPb0";
const tabs = {
  summary: "Player Summary",
  h2h: "Head-to-Head",
  placements: "Placements"
};