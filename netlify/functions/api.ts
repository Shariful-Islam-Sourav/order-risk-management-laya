import serverless from "serverless-http";
import { createApp } from "../../src/app.js";

const app = createApp();

export const handler = serverless(app);
