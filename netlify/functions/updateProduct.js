const { Octokit } = require("@octokit/core");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { token, repo, owner, path, content } = JSON.parse(event.body);

    const octokit = new Octokit({ auth: token });

    // Step 1: Get the current file to retrieve its SHA
    const file = await octokit.request(
      `GET /repos/${owner}/${repo}/contents/${path}`,
      { owner, repo, path }
    );

    const sha = file.data.sha;

    // Step 2: Push updated content to the file
    const response = await octokit.request(
      `PUT /repos/${owner}/${repo}/contents/${path}`,
      {
        owner,
        repo,
        path,
        message: "Product data updated via editor",
        content: Buffer.from(content).toString("base64"),
        sha,
      }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Product updated successfully", response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
