const { Octokit } = require("@octokit/core");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch"); // node-fetch in Netlify functions

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Verify admin token
    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Missing or invalid token" }),
      };
    }

    const token = auth.split(" ")[1];
    // throws if invalid
    jwt.verify(token, process.env.JWT_SECRET);

    // Parse body
    const { repo, owner, path, content, branch } = JSON.parse(event.body);

    if (!owner || !repo || !path || typeof content === "undefined") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameters (owner, repo, path, content)" }),
      };
    }

    // Init GitHub API
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Attempt to GET the file to obtain SHA.
    // If it doesn't exist (404) we will create it (omit sha in PUT).
    let sha;
    try {
      const getParams = { owner, repo, path };
      if (branch) getParams.ref = branch; // optional: fetch from branch
      const file = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", getParams);
      sha = file.data && file.data.sha;
    } catch (getErr) {
      // If file not found -> we'll create it (no sha)
      // Octokit errors expose .status for HTTP status; also check message fallback
      const status = (getErr && getErr.status) || (getErr && getErr.statusCode) || null;
      if (status === 404 || (getErr && String(getErr.message || "").toLowerCase().includes("not found"))) {
        sha = undefined; // create new file
      } else {
        // rethrow other errors so client sees actual problem (permissions, rate limit, etc.)
        console.error("Failed to GET file:", getErr);
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Failed to fetch file information: " + (getErr.message || String(getErr)) }),
        };
      }
    }

    // Prepare PUT params; omit sha when creating new file
    const putParams = {
      owner,
      repo,
      path,
      message: "Product data updated via editor",
      content: Buffer.from(content).toString("base64"),
    };
    if (typeof sha !== "undefined") {
      putParams.sha = sha;
    }
    // If you want to commit to a non-default branch, include `branch` here too:
    if (branch) {
      // GitHub uses `branch` param for create/update contents API
      putParams.branch = branch;
    }

    // Update (or create if sha omitted)
    const response = await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", putParams);

    // Trigger Netlify build hook (non-blocking)
    if (process.env.NETLIFY_BUILD_HOOK_URL) {
      try {
        await fetch(process.env.NETLIFY_BUILD_HOOK_URL, { method: "POST" });
      } catch (hookErr) {
        console.error("Build hook failed:", hookErr && hookErr.message ? hookErr.message : hookErr);
        // don't fail the request for build hook errors
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Product updated and build triggered",
        response: response.data,
      }),
    };
  } catch (error) {
    console.error("Update product failed:", error && (error.stack || error.message || error));
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message || "Unknown error from server",
        detail: String(error),
      }),
    };
  }
};
